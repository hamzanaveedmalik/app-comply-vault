# Access Control Changes - Visual Explanation

## Overview

This document uses Mermaid diagrams to explain all the changes made to implement domain-based access control for Comply Vault.

## 1. Domain-Based Routing Architecture

### Before
```mermaid
graph TB
    Request[All Requests] --> Middleware[Middleware]
    Middleware --> CheckAuth{Has Token?}
    CheckAuth -->|No| Redirect[Redirect to /auth/signin]
    CheckAuth -->|Yes| PublicRoute{Public Route?}
    PublicRoute -->|Yes| Allow[Allow Access]
    PublicRoute -->|No| API[API Route]
    API --> CheckSession{Session Valid?}
    CheckSession -->|No| Deny[401 Unauthorized]
    CheckSession -->|Yes| Allow
```

### After
```mermaid
graph TB
    Request[All Requests] --> Middleware[Middleware]
    Middleware --> GetHostname[Extract Hostname]
    GetHostname --> CheckDomain{Domain Type?}
    
    CheckDomain -->|complyvault.co| MarketingDomain[Marketing Domain]
    CheckDomain -->|app.complyvault.co| AppDomain[App Domain]
    CheckDomain -->|Other/localhost| Default[Default Handler]
    
    MarketingDomain --> MarketingPublic{Public Route?}
    MarketingPublic -->|Yes| AllowMarketing[Allow - Public Access]
    MarketingPublic -->|No| AllowMarketing
    
    AppDomain --> AppPublic{Public Allowlist?}
    AppPublic -->|Yes<br/>/auth/*<br/>/api/auth/*<br/>/api/billing/webhook| AllowAppPublic[Allow - Public]
    AppPublic -->|No| CheckToken{Has Token?}
    CheckToken -->|No| RedirectApp[Redirect to /auth/signin]
    CheckToken -->|Yes| RequireGuard[requireAppAccess Guard]
    RequireGuard --> GuardChecks[Check: Auth, Email, Workspace, Entitlements]
    GuardChecks -->|Pass| AllowApp[Allow - Protected]
    GuardChecks -->|Fail| DenyApp[401/403/402 Error]
    
    Default --> AllowDefault[Allow - For Development]
```

## 2. Access Guard Flow

### requireAppAccess() Guard Function

```mermaid
flowchart TD
    Start[requireAppAccess Called] --> CheckAuth{Session Exists?}
    CheckAuth -->|No| Return401[Return 401: Unauthorized]
    
    CheckAuth -->|Yes| CheckEmail{Email Present?}
    CheckEmail -->|No| Return403[Return 403: Email Required]
    
    CheckEmail -->|Yes| CheckVerified{Email Verified?}
    CheckVerified -->|No| Return403Verify[Return 403: Email Verification Required]
    
    CheckVerified -->|Yes| CheckWorkspace{Workspace ID Present?}
    CheckWorkspace -->|No| Return403Workspace[Return 403: Workspace Required]
    
    CheckWorkspace -->|Yes| VerifyWorkspace[Verify Workspace Exists & User is Member]
    VerifyWorkspace --> WorkspaceExists{Workspace Found?}
    WorkspaceExists -->|No| Return403NotFound[Return 403: Workspace Not Found]
    
    WorkspaceExists -->|Yes| CheckBilling{Billing Status?}
    CheckBilling -->|PILOT| AllowPilot[Allow - Paywall Bypassed]
    
    CheckBilling -->|TRIALING| CheckTrialExpired{Trial Expired?}
    CheckTrialExpired -->|Yes| Return402Trial[Return 402: Trial Expired]
    CheckTrialExpired -->|No| AllowTrial[Allow - Trial Active]
    
    CheckBilling -->|ACTIVE| AllowActive[Allow - Subscription Active]
    
    CheckBilling -->|Other| Return402Inactive[Return 402: Subscription Inactive]
    
    AllowPilot --> ReturnSuccess[Return Success: session + workspaceId]
    AllowTrial --> ReturnSuccess
    AllowActive --> ReturnSuccess
```

## 3. Trial Request Flow (Marketing Domain)

```mermaid
sequenceDiagram
    participant User
    participant MarketingSite[complyvault.co]
    participant Middleware
    participant TrialAPI[/api/trial/request]
    participant RateLimit[Rate Limiter]
    participant Database[(Database)]
    participant EmailService[Email Service]
    participant InternalTeam[Internal Team]

    User->>MarketingSite: Visit / or /uk
    User->>MarketingSite: Fill Trial Request Form
    User->>TrialAPI: POST /api/trial/request<br/>{email, name, company}
    
    TrialAPI->>Middleware: Request (complyvault.co)
    Middleware->>TrialAPI: Allow (Marketing Domain)
    
    TrialAPI->>RateLimit: Check Rate Limit (5/hour per IP)
    RateLimit->>TrialAPI: Allowed
    
    TrialAPI->>TrialAPI: Validate Email Format
    TrialAPI->>Database: Upsert Lead Record
    Database-->>TrialAPI: Lead Stored
    
    par Send Emails
        TrialAPI->>EmailService: Send Verification Email to Lead
        EmailService-->>User: Email with Sign Up Link
    and
        TrialAPI->>EmailService: Send Notification to Team
        EmailService-->>InternalTeam: New Lead Notification
    end
    
    TrialAPI-->>User: 200 Success<br/>(NO SESSION CREATED)
    
    Note over User,InternalTeam: User must sign up at app.complyvault.co
```

## 4. Protected API Route Flow (App Domain)

### Before
```mermaid
sequenceDiagram
    participant Client
    participant API[API Route]
    participant Auth[auth()]
    participant DB[(Database)]

    Client->>API: Request
    API->>Auth: await auth()
    Auth-->>API: session
    
    alt No Session
        API-->>Client: 401 Unauthorized
    else Session Exists
        API->>DB: Query with workspaceId
        DB-->>API: Data
        API-->>Client: 200 Success
    end
    
    Note over API,DB: No email verification check<br/>No entitlement check<br/>No workspace validation
```

### After
```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant API[API Route]
    participant Guard[requireAppAccess]
    participant Auth[auth()]
    participant DB[(Database)]
    participant WorkspaceDB[(Workspace DB)]

    Client->>Middleware: Request (app.complyvault.co)
    Middleware->>Middleware: Check Domain
    Middleware->>Middleware: Check Public Allowlist
    Middleware->>API: Forward Request
    
    API->>Guard: requireAppAccess()
    Guard->>Auth: await auth()
    Auth-->>Guard: session
    
    alt No Session
        Guard-->>API: {ok: false, status: 401}
        API-->>Client: 401 Unauthorized
    else Session Exists
        Guard->>DB: Check Email Verified
        alt Email Not Verified
            Guard-->>API: {ok: false, status: 403}
            API-->>Client: 403 Email Verification Required
        else Email Verified
            Guard->>WorkspaceDB: Verify Workspace & Membership
            alt No Workspace
                Guard-->>API: {ok: false, status: 403}
                API-->>Client: 403 Workspace Required
            else Workspace Found
                Guard->>WorkspaceDB: Check Billing Status
                alt Trial Expired
                    Guard-->>API: {ok: false, status: 402}
                    API-->>Client: 402 Trial Expired
                else Subscription Inactive
                    Guard-->>API: {ok: false, status: 402}
                    API-->>Client: 402 Subscription Inactive
                else Active/Trial
                    Guard-->>API: {ok: true, session, workspaceId}
                    API->>DB: Query with workspaceId
                    DB-->>API: Data
                    API-->>Client: 200 Success
                end
            end
        end
    end
```

## 5. File Changes Overview

```mermaid
graph TB
    Changes[Access Control Changes] --> Created[Created Files]
    Changes --> Modified[Modified Files]
    Changes --> Schema[Schema Changes]
    
    Created --> Guards[src/server/auth/guards.ts<br/>requireAppAccess<br/>requireAuthAndEmailVerified]
    Created --> TrialAPI[src/app/api/trial/request/route.ts<br/>Public Trial Endpoint]
    Created --> Docs[ACCESS_CONTROL_IMPLEMENTATION.md<br/>ACCESS_CONTROL_CHANGES.md]
    
    Modified --> Middleware[src/middleware.ts<br/>Domain Detection & Routing]
    Modified --> Layout[src/app/app/layout.tsx<br/>Server-Side Protection]
    Modified --> UploadInit[src/app/api/upload/init/route.ts]
    Modified --> UploadComplete[src/app/api/upload/complete/route.ts]
    Modified --> MeetingEdit[src/app/api/meetings/id/edit/route.ts]
    Modified --> MeetingFinalize[src/app/api/meetings/id/finalize/route.ts]
    Modified --> Search[src/app/api/search/route.ts]
    
    Schema --> LeadModel[prisma/schema.prisma<br/>Added Lead Model]
    
    style Guards fill:#90EE90
    style TrialAPI fill:#90EE90
    style Middleware fill:#FFD700
    style Layout fill:#FFD700
```

## 6. Security Enforcement Layers

```mermaid
graph TB
    Request[Incoming Request] --> Layer1[Layer 1: Middleware]
    
    Layer1 --> DomainCheck{Domain Check}
    DomainCheck -->|Marketing| MarketingRules[Marketing Rules:<br/>- Public Access<br/>- No Auth Required]
    DomainCheck -->|App| AppRules[App Rules:<br/>- Check Token<br/>- Redirect if No Auth]
    
    MarketingRules --> Layer2M[Layer 2: API Route<br/>Trial Request]
    AppRules --> Layer2A[Layer 2: API Route<br/>Protected Endpoint]
    
    Layer2M --> PublicLogic[Public Logic:<br/>- Rate Limiting<br/>- Email Validation<br/>- Store Lead]
    
    Layer2A --> Layer3[Layer 3: requireAppAccess Guard]
    
    Layer3 --> Check1[1. Authentication]
    Check1 --> Check2[2. Email Verification]
    Check2 --> Check3[3. Workspace Membership]
    Check3 --> Check4[4. Entitlements]
    
    Check4 -->|All Pass| Allow[Allow Access]
    Check4 -->|Any Fail| Deny[Deny with Error]
    
    PublicLogic --> AllowPublic[Allow - No Session]
    
    style Layer3 fill:#FF6B6B
    style Check1 fill:#FFD93D
    style Check2 fill:#FFD93D
    style Check3 fill:#FFD93D
    style Check4 fill:#FFD93D
    style Deny fill:#FF6B6B
    style Allow fill:#6BCF7F
```

## 7. Request Flow Comparison

### Marketing Domain Request
```mermaid
flowchart LR
    A[User on complyvault.co] --> B[Middleware]
    B --> C{Domain Check}
    C -->|Marketing Domain| D[Allow Public]
    D --> E[Trial Request Form]
    E --> F[POST /api/trial/request]
    F --> G[Rate Limit Check]
    G --> H[Store Lead]
    H --> I[Send Emails]
    I --> J[Return 200<br/>NO SESSION]
    
    style J fill:#90EE90
```

### App Domain Request (Protected)
```mermaid
flowchart LR
    A[User on app.complyvault.co] --> B[Middleware]
    B --> C{Domain Check}
    C -->|App Domain| D{Public Route?}
    D -->|Yes| E[Allow]
    D -->|No| F{Has Token?}
    F -->|No| G[Redirect to /auth/signin]
    F -->|Yes| H[API Route]
    H --> I[requireAppAccess]
    I --> J{All Checks Pass?}
    J -->|Yes| K[Allow Access]
    J -->|No| L[Return Error]
    
    style K fill:#6BCF7F
    style L fill:#FF6B6B
```

## 8. Database Schema Changes

```mermaid
erDiagram
    User ||--o{ UserWorkspace : has
    User ||--o{ Account : authenticates
    User {
        string id PK
        string email
        datetime emailVerified
        string name
    }
    
    Workspace ||--o{ UserWorkspace : has
    Workspace ||--o{ Meeting : contains
    Workspace {
        string id PK
        string name
        enum billingStatus
        enum planTier
        datetime trialEndsAt
    }
    
    Lead {
        string id PK
        string email UK
        string name
        string company
        string source
        string ipAddress
        datetime createdAt
    }
    
    UserWorkspace {
        string userId FK
        string workspaceId FK
        enum role
    }
    
    Note1[New Model] Lead
    Note2[Existing Models] User, Workspace, UserWorkspace
```

## 9. API Route Update Pattern

### Before (Example: /api/upload/init)
```mermaid
flowchart TD
    Start[POST /api/upload/init] --> Auth[await auth]
    Auth --> Check{session?.user?.workspaceId?}
    Check -->|No| Deny[401 Unauthorized]
    Check -->|Yes| Logic[Business Logic]
    Logic --> Success[200 Success]
    
    Note1[No email verification check]
    Note2[No entitlement check]
    Note3[No workspace validation]
```

### After (Example: /api/upload/init)
```mermaid
flowchart TD
    Start[POST /api/upload/init] --> Guard[requireAppAccess]
    Guard --> Check1{Auth?}
    Check1 -->|No| Deny1[401 Unauthorized]
    Check1 -->|Yes| Check2{Email Verified?}
    Check2 -->|No| Deny2[403 Email Verification Required]
    Check2 -->|Yes| Check3{Workspace?}
    Check3 -->|No| Deny3[403 Workspace Required]
    Check3 -->|Yes| Check4{Entitlements?}
    Check4 -->|No| Deny4[402 Trial/Subscription Issue]
    Check4 -->|Yes| Access[Access Granted]
    Access --> Logic[Business Logic]
    Logic --> Success[200 Success]
    
    style Access fill:#6BCF7F
    style Deny1 fill:#FF6B6B
    style Deny2 fill:#FF6B6B
    style Deny3 fill:#FF6B6B
    style Deny4 fill:#FF6B6B
```

## 10. Complete Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> RequestReceived: HTTP Request
    
    RequestReceived --> DomainDetection: Extract Hostname
    
    DomainDetection --> MarketingDomain: complyvault.co
    DomainDetection --> AppDomain: app.complyvault.co
    DomainDetection --> Default: Other/localhost
    
    MarketingDomain --> MarketingPublic: Check Public Route
    MarketingPublic --> TrialRequest: /api/trial/request
    MarketingPublic --> MarketingPage: Other Pages
    TrialRequest --> RateLimit: Check Rate Limit
    RateLimit --> StoreLead: Store in Database
    StoreLead --> SendEmails: Send Notifications
    SendEmails --> ReturnSuccess: 200 (No Session)
    MarketingPage --> ReturnSuccess
    
    AppDomain --> AppPublic: Check Allowlist
    AppPublic --> PublicAllowed: /auth/*, /api/auth/*
    AppPublic --> ProtectedRoute: Other Routes
    
    ProtectedRoute --> CheckToken: Has Auth Token?
    CheckToken --> RedirectSignIn: No Token
    CheckToken --> RequireGuard: Has Token
    
    RequireGuard --> CheckAuth: Verify Session
    CheckAuth --> CheckEmail: Email Verified?
    CheckEmail --> CheckWorkspace: Workspace Member?
    CheckWorkspace --> CheckEntitlements: Trial/Paid Active?
    
    CheckEntitlements --> AllowAccess: All Checks Pass
    CheckEntitlements --> ReturnError: Any Check Fails
    
    PublicAllowed --> AllowAccess
    Default --> AllowAccess
    
    ReturnSuccess --> [*]
    ReturnError --> [*]
    RedirectSignIn --> [*]
    AllowAccess --> [*]
```

## Summary of Changes

### Core Changes
1. **Domain Detection**: Middleware now detects and routes based on hostname
2. **Access Guards**: New `requireAppAccess()` function enforces 4-layer security
3. **Trial Endpoint**: Public endpoint for marketing domain (no session creation)
4. **Lead Model**: Database schema for storing trial requests

### Security Improvements
- ✅ Email verification required
- ✅ Workspace membership validated
- ✅ Entitlements checked (trial/subscription)
- ✅ Domain-based routing prevents unauthorized access
- ✅ Rate limiting on public endpoints

### Files Changed
- **Created**: 3 new files (guards, trial API, docs)
- **Modified**: 8 files (middleware, layout, 5 API routes, schema)
- **Remaining**: ~20 API routes need guard updates
