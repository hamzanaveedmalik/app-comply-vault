// Simple metrics collection utility for observability

interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface Histogram {
  name: string;
  buckets: number[];
  values: Record<string, number>;
  count: number;
  sum: number;
  labels?: Record<string, string>;
}

interface Counter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

class MetricsRegistry {
  private metrics: Record<string, Metric> = {};
  private histograms: Record<string, Histogram> = {};
  private counters: Record<string, Counter> = {};
  private startTime = Date.now();

  // Record a simple metric value
  public recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.metrics[key] = {
      name,
      value,
      labels,
      timestamp: Date.now(),
    };
  }

  // Initialize a histogram with buckets
  public createHistogram(name: string, buckets: number[], labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const values: Record<string, number> = {};
    
    // Initialize bucket counters
    for (const bucket of buckets) {
      values[bucket] = 0;
    }
    
    this.histograms[key] = {
      name,
      buckets,
      values,
      count: 0,
      sum: 0,
      labels,
    };
  }

  // Record a value in a histogram
  public observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    
    // Create histogram if it doesn't exist with default buckets
    if (!this.histograms[key]) {
      this.createHistogram(name, [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], labels);
    }
    
    const histogram = this.histograms[key];
    histogram.count += 1;
    histogram.sum += value;
    
    // Increment all buckets that this value falls into
    for (const bucket of histogram.buckets) {
      if (value <= bucket) {
        histogram.values[bucket] += 1;
      }
    }
  }

  // Increment a counter
  public incrementCounter(name: string, amount: number = 1, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    
    if (!this.counters[key]) {
      this.counters[key] = { name, value: 0, labels };
    }
    
    this.counters[key].value += amount;
  }

  // Get a specific metric
  public getMetric(name: string, labels: Record<string, string> = {}): Metric | null {
    const key = this.getMetricKey(name, labels);
    return this.metrics[key] || null;
  }

  // Get all metrics in Prometheus format
  public getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Add simple metrics
    for (const key in this.metrics) {
      const metric = this.metrics[key];
      lines.push(`# TYPE ${metric.name} gauge`);
      lines.push(`${metric.name}${this.formatLabels(metric.labels)} ${metric.value}`);
    }
    
    // Add histograms
    for (const key in this.histograms) {
      const histogram = this.histograms[key];
      lines.push(`# TYPE ${histogram.name} histogram`);
      
      // Add bucket entries
      for (const bucket of histogram.buckets) {
        lines.push(
          `${histogram.name}_bucket${this.formatLabels({ ...histogram.labels, le: String(bucket) })} ${histogram.values[bucket]}`
        );
      }
      
      // Add sum and count
      lines.push(`${histogram.name}_sum${this.formatLabels(histogram.labels)} ${histogram.sum}`);
      lines.push(`${histogram.name}_count${this.formatLabels(histogram.labels)} ${histogram.count}`);
    }
    
    // Add counters
    for (const key in this.counters) {
      const counter = this.counters[key];
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name}${this.formatLabels(counter.labels)} ${counter.value}`);
    }
    
    // Add uptime metric
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    lines.push(`# TYPE app_uptime_seconds gauge`);
    lines.push(`app_uptime_seconds ${uptimeSeconds}`);
    
    return lines.join('\n');
  }

  // Format labels for Prometheus output
  private formatLabels(labels: Record<string, string> = {}): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const parts = Object.entries(labels).map(([key, value]) => `${key}="${value}"`);
    return `{${parts.join(',')}}`;
  }

  // Get a unique key for a metric based on name and labels
  private getMetricKey(name: string, labels: Record<string, string> = {}): string {
    const labelKeys = Object.keys(labels).sort();
    const labelStr = labelKeys.map(key => `${key}=${labels[key]}`).join(',');
    return labelStr ? `${name}:${labelStr}` : name;
  }
}

// Create singleton instance
export const metrics = new MetricsRegistry();

// Performance measurement utility
export function measureExecutionTime<T>(
  name: string, 
  fn: () => T | Promise<T>,
  labels: Record<string, string> = {}
): Promise<T> {
  const startTime = performance.now();
  
  const result = fn();
  
  const recordDuration = (res: T): T => {
    const duration = performance.now() - startTime;
    metrics.observeHistogram(`${name}_duration_seconds`, duration / 1000, labels);
    return res;
  };
  
  if (result instanceof Promise) {
    return result.then(recordDuration);
  } else {
    return Promise.resolve(recordDuration(result));
  }
}