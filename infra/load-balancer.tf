// Terraform configuration for setting up GCP load balancing for Cloud Run

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The name of the Cloud Run service"
  type        = string
  default     = "ria-compliance-tool"
}

// Create a global address for the load balancer
resource "google_compute_global_address" "default" {
  name = "ria-compliance-lb-ip"
}

// Create a certificate managed by Google for HTTPS
resource "google_compute_managed_ssl_certificate" "default" {
  name = "ria-compliance-cert"

  managed {
    domains = [var.domain_name]
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

// Set up a serverless NEG to connect to Cloud Run
resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  name                  = "ria-compliance-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = var.service_name
  }
}

// Create a backend service that points to the NEG
resource "google_compute_backend_service" "default" {
  name                  = "ria-compliance-backend"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  enable_cdn            = true
  
  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }
}

// URL map to route requests to the backend
resource "google_compute_url_map" "default" {
  name            = "ria-compliance-urlmap"
  default_service = google_compute_backend_service.default.id
}

// HTTP proxy for the URL map
resource "google_compute_target_https_proxy" "default" {
  name             = "ria-compliance-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

// HTTP-to-HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  name = "ria-compliance-http-redirect"
  
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  name    = "ria-compliance-http-redirect"
  url_map = google_compute_url_map.http_redirect.id
}

// HTTPS forwarding rule
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "ria-compliance-https-rule"
  target                = google_compute_target_https_proxy.default.id
  port_range            = "443"
  ip_address            = google_compute_global_address.default.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

// HTTP forwarding rule (for redirection to HTTPS)
resource "google_compute_global_forwarding_rule" "http" {
  name                  = "ria-compliance-http-rule"
  target                = google_compute_target_http_proxy.http_redirect.id
  port_range            = "80"
  ip_address            = google_compute_global_address.default.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

// Output the external IP address
output "load_balancer_ip" {
  value = google_compute_global_address.default.address
}

output "service_url" {
  value = "https://${var.domain_name}"
}