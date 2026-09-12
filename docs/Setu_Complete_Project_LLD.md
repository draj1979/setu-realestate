# Setu — SaaS Low-Level Design

## Real Estate AI Sales Agent Platform

**Document purpose:** Implementation handoff for a fresh development session.

**Product:** Setu — a SaaS platform for real-estate builders that provides an AI sales agent over WhatsApp.

**Primary channel:** WhatsApp only.

**Target customer:** Real-estate builders / developers with one or more projects.

**Core proposition:**

> Configure your project once. Upload your project knowledge. Connect your WhatsApp number and Google Calendar. Setu's AI sales agent greets prospects, conducts intelligent conversations, qualifies leads, follows up, and books site visits automatically.

---

# 1. Scope and Product Decisions

## 1.1 Product model

Setu is a multi-tenant SaaS platform.

The hierarchy is:

```text
Organization
    |
    +-- Users
    |
    +-- Projects
           |
           +-- Project Knowledge
           +-- AI Agent Configuration
           +-- WhatsApp Channel
           +-- Google Calendar
           +-- Leads
           +-- Conversations
           +-- Follow-ups
           +-- Site Visits
           +-- Analytics
           +-- Media
```

An organization represents a builder/business.

A builder can have multiple projects.

The subscription is charged **per active project per month**.

Initial commercial positioning:

> Plans start at ₹20,000 per project per month.

The exact plan catalogue, limits, taxes, payment gateway and billing implementation may be finalized separately. The application must nevertheless model subscriptions at project level.

---

# 2. Explicit Product Constraints

## 2.1 Only WhatsApp is a customer communication channel

Do NOT implement separate end-user channels for:

- Website chat
- Instagram
- Facebook Messenger
- SMS
- Email
- Voice

WhatsApp is the only customer-facing conversational channel in V1.

The assumption is that other acquisition channels ultimately lead customers to WhatsApp.

The architecture should keep the channel abstraction clean enough that additional channels can be introduced later, but no UI, configuration or implementation work for other channels is required in V1.

```text
Customer
   |
   v
WhatsApp
   |
   v
Setu WhatsApp Webhook
   |
   v
Conversation / Lead
   |
   v
AI Sales Agent
```

## 2.2 Model

Use:

```text
Google Gemini 3.1 Flash Lite
```

as the initial and default model.

The model must be accessed through a model-provider abstraction so that changing models later does not require rewriting the agent runtime.

## 2.3 Database

Use:

```text
Cloud SQL for PostgreSQL
```

with Prisma ORM.

Do not use Cloud SQL for the new SaaS architecture.

## 2.4 Storage

Use private object storage for uploaded files and project media.

Google Cloud Storage may be retained if already available in the implementation.

## 2.5 Runtime

The existing application uses Next.js, Prisma/Postgres, OpenClaw + Gemini and Cloud Run.

The SaaS version should retain the proven application stack where practical, but refactor the runtime for:

- multi-tenancy
- asynchronous message processing
- multiple projects
- multiple WhatsApp configurations
- persistent jobs
- safer agent execution

---

# 2A. Final V1 Architecture Decisions

The following decisions supersede conflicting implementation choices from the earlier MVP:

1. Product name is **Setu**.
2. **Cloud SQL for PostgreSQL** is the primary transactional database.
3. **OpenClaw is the backbone of the AI agent runtime**.
4. Each builder organization has **one dedicated OpenClaw agent/runtime**.
5. A builder's OpenClaw agent may operate across multiple projects belonging to that builder.
6. WhatsApp remains the only customer-facing conversational channel in V1.
7. **Google Cloud Pub/Sub** is the primary event bus.
8. **Google Cloud Tasks** is used for delayed individual actions such as follow-ups.
9. **Google Cloud Storage** is used for private project documents and media.
10. **Secret Manager** stores platform and integration secrets.
11. **Identity Platform** handles builder authentication.
12. **Cloud Run** is the primary application/runtime platform.
13. Setu is the SaaS control plane and system of record; OpenClaw is the agent plane.
14. Tenant isolation is enforced by Setu and applies to every API and tool invocation.
15. The architecture should remain a small number of deployable workloads rather than a large microservice fleet.

# 3. Existing MVP Reference

The existing Setu implementation is a single-builder WhatsApp sales agent.

Its current scope is one builder, one WhatsApp number and PDF-only knowledge. The existing LLD explicitly identifies multi-tenancy as a future concern.

The current flow is:

```text
WhatsApp inbound message
        |
        v
Webhook
        |
        v
Lead lookup / creation
        |
        v
Agent turn
        |
        v
Agent tools
        |
        +--> update lead
        +--> request brochure
        +--> propose site visit
        +--> confirm site visit
        +--> switch project
        +--> handoff
        |
        v
WhatsApp reply
```

The current lead lifecycle is:

```text
NEW
  -> GREETED
  -> QUALIFYING
  -> QUALIFIED
  <-> FOLLOWUP
  -> SITE_VISIT_SCHEDULED
  -> HANDED_OFF
  -> LOST
```

The current implementation also has:

- WhatsApp HMAC verification
- webhook deduplication using WhatsApp message ID
- rate limiting
- brochure upload
- PDF text extraction
- follow-up cron
- site visit workflow
- human handoff
- project switching
- agent persona files
- MCP tools

These concepts should be retained where they fit the SaaS architecture.

---

# 4. Builder User Experience

The builder experience must be simple enough for a non-technical real-estate business user.

## 4.1 Entry flow

```text
Landing Page
    |
    +--> Talk to Architect
    |
    +--> Sign Up
    |
    +--> Sign In
```

## 4.2 Talk to Architect

The **Talk to Architect** CTA must link to:

https://calendly.com/dharam-tiwari/30min

This should be used consistently across the website wherever the CTA is presented.

Do not create an internal scheduling flow for this CTA.

This is separate from the Google Calendar integration used by each builder for customer site visits.

## 4.3 Footer

Remove any "Clear WhatsApp Number" / WhatsApp-number clearing control or equivalent utility from the public website footer.

Do not expose a customer-facing control in the footer that clears or resets the configured WhatsApp number.

---

# 5. Authentication

## 5.1 Sign Up

Allow:

- Mobile number signup
- Email signup

The UX should offer an explicit choice:

```text
Sign up with Email
Sign up with Mobile
```

Authentication implementation can use OTP for mobile and email verification/password or magic-link depending on the chosen auth implementation.

The exact provider is implementation-dependent, but the data model must support both.

## 5.2 Sign In

Allow users to sign in using the authentication method associated with their account.

The user belongs to one or more organizations through membership.

## 5.3 Core entities

```text
User
Organization
OrganizationMembership
Session
```

Minimum organization roles:

```text
OWNER
ADMIN
MANAGER
VIEWER
```

For V1, OWNER and ADMIN may share most capabilities, but the role must exist in the model so RBAC can evolve.

---

# 6. SaaS Project Lifecycle

The primary builder journey is:

```text
Sign Up
   |
   v
Create Project
   |
   v
Upload Brochure
   |
   v
Upload Supporting Documents
   |
   v
Upload Project Graphics
   |
   v
Add Promo Video Links
   |
   v
Configure WhatsApp
   |
   v
Configure Agent
   |
   v
Configure Google Calendar
   |
   v
Review Configuration
   |
   v
Activate Agent
   |
   v
Agent LIVE
```

A project must not become ACTIVE until all mandatory configuration requirements are satisfied.

---

# 7. Project Setup

A builder creates a project with:

```text
Project Name
Project Address
RERA Number
Project Description
Location
Status
```

Optional structured project information should include:

```text
Developer / Builder Name
Project Type
Possession Information
Configurations
Price Range
Amenities
Nearby Landmarks
Sales Office Details
Site Visit Location
```

The platform should support project-specific structured data rather than forcing the AI to infer everything from documents.

---

# 8. Project Knowledge

The builder must be able to upload multiple knowledge sources.

## 8.1 Required / primary document

### Brochure

Supported:

```text
PDF
```

The brochure describes the project and is one of the main sources used by the agent.

## 8.2 Additional documents

The builder must be able to upload:

- Price list
- RERA certificate
- Legal documents
- Discount / offer policies
- FAQ
- Payment plans
- Specifications
- Floor-plan documents
- Terms and conditions
- Other project-related documents

Each document must belong to exactly one project.

## 8.3 Document lifecycle

```text
UPLOADED
   |
   v
PROCESSING
   |
   +--> READY
   |
   +--> FAILED
```

For each document store:

```text
id
projectId
fileName
mimeType
storagePath
documentType
status
extractedText
createdAt
updatedAt
processingError
```

## 8.4 Knowledge processing

For text PDFs:

```text
Upload
  |
  v
Object Storage
  |
  v
Extract text
  |
  v
Normalize
  |
  v
Chunk
  |
  v
Index
  |
  v
READY
```

For scanned PDFs, OCR may be introduced later. It is not mandatory for the first SaaS implementation unless already supported.

---

# 9. Hybrid Knowledge Architecture

Do not rely exclusively on sending every uploaded document into the Gemini context.

Use two knowledge categories.

## 9.1 Structured project data

PostgreSQL is authoritative for:

- project information
- configurations
- pricing
- inventory if implemented
- site visit information
- policies that require structured querying
- agent configuration

## 9.2 Unstructured knowledge

Use document retrieval for:

- brochures
- legal documents
- FAQs
- descriptive content
- RERA documents
- policy documents
- other uploaded documents

Conceptually:

```text
                         Agent
                           |
              +------------+------------+
              |                         |
              v                         v
      Structured Data              Knowledge Search
       PostgreSQL                       |
              |                         v
              |                    Document chunks
              |                         |
              +------------+------------+
                           |
                           v
                       Gemini
```

The exact vector/search technology can be selected during implementation. Cloud SQL for PostgreSQL should remain the primary transactional database.

---

# 10. Project Graphics and Media

Builders must be able to upload graphics for the project.

Examples:

- project images
- amenity images
- floor-plan images
- location images
- marketing creatives

Model:

```text
ProjectMedia
    id
    projectId
    type
    storagePath
    fileName
    title
    description
    createdAt
```

Types:

```text
PROJECT_IMAGE
AMENITY_IMAGE
FLOOR_PLAN
LOCATION_IMAGE
MARKETING_GRAPHIC
OTHER
```

The agent should be able to identify relevant media when responding to customers.

---

# 11. Promo Video Links

Builders must be able to add promotional video URLs.

Model:

```text
ProjectVideo
    id
    projectId
    url
    title
    description
    platform
    isActive
```

Examples:

```text
YouTube
Vimeo
Other supported public video URLs
```

The agent may share the configured video link when appropriate.

Do not download and re-host videos in V1.

---

# 12. WhatsApp Configuration

Each project can have its own WhatsApp configuration.

Minimum fields:

```text
WhatsAppChannel
    id
    projectId
    phoneNumberId
    businessAccountId
    displayNumber
    accessToken / secret reference
    appSecret / secret reference
    verifyToken / secret reference
    status
```

Credentials must be stored securely.

Do not expose access tokens in frontend responses.

## 12.1 Webhook routing

The webhook must determine:

```text
WhatsApp phone number ID
       |
       v
WhatsAppChannel
       |
       v
Project
       |
       v
Lead
       |
       v
Conversation
```

This is essential for multi-project SaaS.

Do not route an inbound message to an arbitrary oldest ACTIVE project as the current MVP does.

The WhatsApp phone number configuration must be authoritative.

---

# 13. WhatsApp Message Flow

The new SaaS flow should be asynchronous.

```text
Meta WhatsApp
      |
      v
Webhook
      |
      +--> Verify signature
      |
      +--> Identify channel/project
      |
      +--> Deduplicate message ID
      |
      +--> Persist inbound message
      |
      +--> Update/create lead
      |
      +--> Enqueue agent job
      |
      v
HTTP 200 immediately
```

Then:

```text
Agent Queue
     |
     v
Agent Worker
     |
     +--> Load project configuration
     +--> Load lead
     +--> Load conversation
     +--> Retrieve relevant knowledge
     +--> Run Gemini
     +--> Execute tools
     +--> Persist tool effects
     +--> Persist outbound message
     +--> Send WhatsApp response
```

The webhook must not wait synchronously for the full agent execution.

---

# 14. Lead Model

Lead remains the central sales object.

Suggested model:

```text
Lead
    id
    projectId
    whatsappNumber
    name
    source
    stage

    configuration
    budget
    purpose
    timeline
    preferredLocation

    leadScore
    intent
    buyingSignals
    objections

    assignedUserId

    followupCount
    lastInboundAt
    lastOutboundAt
    nextFollowupAt

    handoffReason

    createdAt
    updatedAt
```

Unique constraint:

```text
(projectId, whatsappNumber)
```

WhatsApp number should be normalized before persistence.

---

# 15. Lead Lifecycle

Recommended lifecycle:

```text
NEW
  |
  v
ENGAGED
  |
  v
QUALIFYING
  |
  v
QUALIFIED
  |
  +--------------------+
  |                    |
  v                    v
FOLLOWUP          SITE_VISIT_PROPOSED
  |                    |
  |                    v
  |              SITE_VISIT_SCHEDULED
  |                    |
  |                    v
  |             SITE_VISIT_COMPLETED
  |
  v
LOST

Any relevant stage
  |
  v
HANDED_OFF
```

Stage transitions should be driven by agent actions, workflow logic or authorized builder actions.

---

# 16. Lead Qualification

The agent should intelligently qualify leads.

Initial qualification fields:

```text
Name
Configuration
Budget
Purpose
Timeline
Preferred Location
```

The agent should not interrogate the customer mechanically.

It should infer information naturally from the conversation and ask only for useful missing information.

Example:

Customer:

> I am looking for a 3 BHK around 1.5 crore for my family.

The agent should capture:

```text
configuration = 3 BHK
budget ≈ 1.5 crore
purpose = self use / family
```

without asking the same questions again.

---

# 17. Lead Scoring

Add a lead score from 0–100.

The score can consider:

```text
Budget fit
Configuration fit
Timeline
Engagement
Buying intent
Site visit intent
```

Example:

```text
Lead Score: 87
Intent: HIGH
Status: HOT
```

The exact scoring algorithm may initially be rule-based plus model-assisted.

The score must be explainable enough for dashboard users.

---

# 18. AI Agent Configuration

The builder must configure the agent without editing code.

Configuration sections:

## Identity

```text
Agent Name
Role
Identity description
```

Example:

> "You are the friendly sales consultant for ABC Builders."

## Vibe

Controls:

```text
Professional
Friendly
Premium
Consultative
Energetic
Minimal
Formal
Conversational
```

The UI may provide presets plus an optional custom instruction.

## Goal

Builder specifies the desired sales objective.

Example:

> "Help prospective buyers understand the project, qualify their requirements and encourage suitable prospects to visit the property."

## Rules

Builder can configure business rules such as:

```text
Do not invent prices.
Do not promise unavailable units.
Do not provide legal advice.
Escalate legal questions to a human.
Escalate complaints.
```

The platform should combine:

```text
System Safety Rules
+
Platform Agent Rules
+
Builder Configuration
+
Project Knowledge
+
Conversation Context
```

Builder configuration must never be allowed to override system safety or platform constraints.

---

# 19. Agent Goal

The agent's default workflow is:

```text
Greet
  |
  v
Understand requirement
  |
  v
Qualify
  |
  v
Provide relevant information
  |
  v
Answer questions
  |
  v
Handle objections
  |
  v
Follow up when appropriate
  |
  v
Propose site visit
  |
  v
Book site visit
  |
  v
Notify / hand off to sales team
```

The agent should optimize for useful conversation and qualified site visits, not simply maximum message volume.

---

# 20. Agent Tools

The existing MCP tool concept should be retained, but the tools should become project-aware.

Initial tools:

```text
get_project_information
search_project_knowledge
get_project_media
get_project_video
update_lead
calculate_or_update_lead_score
propose_site_visit
get_available_site_visit_slots
book_site_visit
send_brochure
send_project_media
send_video_link
handoff_to_human
schedule_followup
```

Each tool must validate:

```text organizationId
projectId
leadId
```

where applicable.

The agent must never access data from another organization's project.

---

# 21. Google Calendar Integration

Each project may configure a Google Calendar used for customer site visits.

Builder setup:

```text
Project Settings
    |
    v
Google Calendar
    |
    v
Connect Google Account
    |
    v
Select Calendar
    |
    v
Configure Site Visit Duration
    |
    v
Configure Working Hours
```

Store OAuth tokens securely.

Never store OAuth access/refresh tokens in plaintext database fields if the chosen infrastructure provides a secure secret mechanism.

The model should contain a reference to encrypted credentials or a credential record.

---

# 22. Site Visit Booking

Agent flow:

```text
Customer expresses visit interest
       |
       v
Agent calls get_available_site_visit_slots
       |
       v
Google Calendar availability
       |
       v
Agent proposes suitable slots
       |
       v
Customer selects slot
       |
       v
book_site_visit
       |
       v
Google Calendar event created
       |
       v
Lead status = SITE_VISIT_SCHEDULED
       |
       v
Confirmation sent on WhatsApp
```

Calendar event should include:

```text
Customer name
Customer phone
Project name
Site visit date/time
Lead ID
```

Where appropriate, include project address and contact information.

The system must prevent double-booking by checking calendar availability immediately before event creation.

---

# 23. Follow-up Engine

The existing scheduled follow-up capability should become a persistent job system rather than depending only on a single cron implementation.

Conceptually:

```text
Lead
  |
  v
nextFollowupAt
  |
  v
Job Scheduler
  |
  v
Followup Worker
  |
  v
Agent
  |
  v
WhatsApp
```

Follow-up policy should be configurable at platform/project level.

Default behavior may be:

```text
Follow-up #1 after 24 hours
Follow-up #2 after another 24 hours
Stop after configured maximum
```

The agent should use conversation context and lead state to generate the follow-up.

Do not send follow-ups after:

- customer opts out
- site visit is booked
- lead is handed to human
- lead is marked LOST
- project/agent is deactivated

---

# 24. Conversation Model

A lead has one logical conversation per WhatsApp identity and project.

Recommended:

```text
Conversation
    id
    projectId
    leadId
    channelId
    status
    createdAt
    updatedAt
```

Messages:

```text
Message
    id
    conversationId
    direction
    body
    messageType
    waMessageId
    metadata
    createdAt
```

Inbound WhatsApp message ID must remain unique for deduplication.

---

# 25. Agent Runtime

Do not retain the current synchronous architecture:

```text
Next.js
  -> openclaw subprocess
      -> MCP subprocess
```

as the primary SaaS execution model.

Use:

```text
Webhook
   |
   v
Queue
   |
   v
Agent Worker
   |
   v
Agent Runtime
   |
   +--> Gemini
   +--> Knowledge
   +--> Tool Registry
   +--> Project Configuration
   +--> Conversation
```

The runtime should be stateless between turns except for persisted application state.

If OpenClaw remains part of the implementation, isolate it behind the agent runtime boundary so that the rest of the SaaS platform does not depend directly on OpenClaw process semantics.

---

# 26. Agent Context

For every turn construct context from:

```text
System instructions
+
Builder agent identity/vibe/goal
+
Project information
+
Relevant retrieved knowledge
+
Lead profile
+
Recent conversation history
+
Relevant previous tool results
```

Do not inject all documents into every prompt.

Use retrieval to keep context relevant.

---

# 26A. OpenClaw Agent Provisioning and Isolation

Setu must maintain a one-to-one mapping between an organization and its dedicated OpenClaw agent.

Conceptually:

```text
Organization
    |
    +-- openclawAgentId
    +-- runtime/workspace reference
    +-- agent status
```

Agent lifecycle:

```text
Builder signs up
      |
      v
Organization created
      |
      v
Provision OpenClaw Agent
      |
      v
Configure base Setu agent
      |
      v
Attach organization context
      |
      v
READY
      |
      v
ACTIVE
```

The OpenClaw agent must not receive unrestricted database credentials.

Setu should expose project-aware capabilities through a controlled tool/API layer. Tool execution must validate:

```text
organizationId
projectId
leadId
```

where applicable.

The OpenClaw agent may handle multiple projects belonging to the same builder, but project context must be explicit on every customer interaction.

The authoritative routing chain is:

```text
WhatsApp phone_number_id
        |
        v
WhatsAppChannel
        |
        v
Project
        |
        v
Organization
        |
        v
OpenClaw Agent
```

This prevents cross-builder and cross-project context leakage.

## OpenClaw Agent Configuration

Each agent receives:

```text
Platform safety rules
+
Builder agent identity
+
Builder vibe
+
Builder goal
+
Builder business rules
+
Project configuration
+
Project knowledge retrieval
+
Conversation context
+
Lead context
```

Builder instructions remain subordinate to Setu platform safety rules.

## OpenClaw Tool Boundary

OpenClaw should access Setu business capabilities through a controlled tool registry/API.

Initial tools:

```text
get_project_information
search_project_knowledge
get_project_media
get_project_video
update_lead
calculate_or_update_lead_score
propose_site_visit
get_available_site_visit_slots
book_site_visit
send_brochure
send_project_media
send_video_link
handoff_to_human
schedule_followup
```

The tools are implemented by Setu and are not trusted to infer tenant identity from arbitrary user input. Tenant and project context are resolved by Setu before execution.

## OpenClaw Runtime Deployment

The initial GCP deployment should use Cloud Run for the OpenClaw runtime where compatible with the selected OpenClaw deployment model.

Setu should provide an OpenClaw Agent Manager responsible for:

```text
create agent
start agent
pause agent
resume agent
configure agent
health check
route request
retire agent
```

The Agent Manager maintains:

```text
organizationId
openclawAgentId
runtime reference
status
createdAt
updatedAt
```

The implementation should avoid creating a large microservice fleet. OpenClaw isolation is required per builder, but the management/control-plane services should remain consolidated unless operational scale requires further decomposition.

# 27. Model Gateway

Create an internal abstraction:

```text
ModelGateway
    |
    +-- GeminiProvider
```

Configuration:

```text
provider = google
model = gemini-3.1-flash-lite
```

All model calls should capture:

```text
organizationId
projectId
agentId
leadId
model
inputTokens
outputTokens
latency
status
error
```

This data supports usage analytics and future billing.

---

# 28. Multi-Tenant Security

Every request must resolve:

```text
user
  -> organization membership
  -> project authorization
```

Every project-scoped query must enforce organization ownership.

Never trust `projectId` supplied by the frontend without authorization checking.

Examples:

```text
GET /api/projects/:projectId/leads
```

must verify:

```text authenticated user
AND
organization membership
AND
project belongs to organization
```

Agent tool calls require equivalent authorization boundaries.

---

# 29. Suggested Database Schema

Core:

```text
User
Organization
OrganizationMembership
Session

Project
ProjectSubscription

WhatsAppChannel
GoogleCalendarConnection

AgentConfiguration

Lead
Conversation
Message
LeadEvent
FollowupJob
SiteVisit

Document
DocumentChunk
ProjectMedia
ProjectVideo

AgentRun
AgentToolCall

UsageEvent
AuditLog
```

Optional future entities:

```text
Unit
UnitInventory
PriceList
Offer
SalesPerson
AssignmentRule
Notification
Integration
```

---

# 30. Project Subscription

Because pricing is per project, model subscription at project level.

```text
ProjectSubscription
    id
    projectId
    plan
    status
    monthlyPrice
    billingProvider
    externalSubscriptionId
    currentPeriodStart
    currentPeriodEnd
    createdAt
    updatedAt
```

Possible status:

```text
TRIAL
ACTIVE
PAST_DUE
PAUSED
CANCELLED
```

Do not hard-code ₹20,000 throughout the application.

Store pricing/plans in configuration or billing tables.

The marketing website may state:

> Plans starting at ₹20,000 per project per month.

---

# 31. Agent Activation

The builder sees an activation checklist:

```text
Project created                     ✓
Brochure uploaded                   ✓
Knowledge configured                ✓
WhatsApp connected                  ✓
Agent identity configured            ✓
Agent goal configured               ✓
Google Calendar connected            ✓
Subscription active                 ✓
```

Then:

```text
[ ACTIVATE AI AGENT ]
```

Before activation, validate all required prerequisites.

Agent states:

```text
DRAFT
READY
ACTIVE
PAUSED
ERROR
```

---

# 32. Agent Activation Behavior

Once ACTIVE:

```text
WhatsApp inbound
      |
      v
Project resolved
      |
      v
Agent enabled?
      |
   YES
      |
      v
Process conversation
```

If PAUSED:

```text
Persist inbound message
+
Do not send AI response
+
Show message in dashboard
```

This lets builders temporarily disable the AI without disconnecting WhatsApp.

---

# 33. Builder Dashboard

The dashboard is organized by project.

```text
Dashboard
|
+-- Overview
+-- Projects
|     +-- Project A
|     +-- Project B
|
+-- Leads
+-- Conversations
+-- Site Visits
+-- Knowledge
+-- Agent
+-- WhatsApp
+-- Calendar
+-- Analytics
+-- Settings
```

---

# 34. Project Dashboard

Each project should show:

```text
Total Leads
New Leads
Qualified Leads
Hot Leads
Follow-ups Due
Site Visits Booked
Site Visits Completed
Human Handoffs
Lost Leads
```

Also show:

```text
Lead conversion funnel
Conversation volume
Qualification rate
Site visit conversion
AI response metrics
```

---

# 35. Analytics

Primary funnel:

```text
Leads
  ↓
Engaged
  ↓
Qualified
  ↓
Site Visit Proposed
  ↓
Site Visit Booked
  ↓
Site Visit Completed
```

Metrics:

```text
Total Leads
Qualified Leads
Qualification Rate
Average Lead Score
Site Visits Booked
Site Visit Conversion Rate
Follow-ups Sent
Follow-up Response Rate
Human Handoffs
Lost Leads
```

Later:

```text
Booking conversion
Revenue influenced
Cost per qualified lead
AI-assisted revenue
```

---

# 36. Conversation Analytics

Dashboard should allow builder to see:

- total conversations
- conversations per day
- average messages per lead
- average response time
- qualification rate
- common customer questions
- common objections
- handoff reasons
- site visit intent

The system should preserve enough structured data to generate future AI insights.

---

# 37. Lead Detail View

A builder should be able to open a lead and see:

```text
Customer
Phone
Project
Lead Score
Stage
Intent

Requirement
Budget
Configuration
Purpose
Timeline

Conversation
    complete WhatsApp transcript

AI Summary
    customer need
    buying signals
    objections
    next best action

Follow-up history

Site visit history

Handoff history
```

---

# 38. AI Conversation Summary

For long conversations, generate and persist a compact summary:

```text
Customer wants a 3 BHK for self use.
Budget approximately ₹1.5 Cr.
Interested in possession within 12 months.
Asked about school proximity.
Requested brochure.
Open to visiting Saturday afternoon.
```

Use the summary to reduce context size.

---

# 39. Human Handoff

Agent can hand off when:

- customer explicitly asks for human
- complaint
- legal question
- negotiation beyond configured rules
- sensitive issue
- high-value lead requiring salesperson
- agent confidence is low
- technical/system issue

Handoff should:

```text
Lead.stage = HANDED_OFF
Lead.handoffReason = ...
```

and create an event.

Builder dashboard should clearly highlight handed-off leads.

---

# 40. Notifications

V1 notifications can focus on high-value events:

```text
New hot lead
Site visit booked
Human handoff
Agent error
WhatsApp connection issue
Calendar connection issue
```

Notification channels for the builder can initially be dashboard notifications and email if implemented.

WhatsApp remains the only customer communication channel.

---

# 41. APIs

## Authentication

```text
POST /api/auth/signup/email
POST /api/auth/signup/mobile
POST /api/auth/verify
POST /api/auth/login
POST /api/auth/logout
```

## Organizations

```text
GET  /api/organization
PATCH /api/organization
GET  /api/organization/members
POST /api/organization/members
```

## Projects

```text
GET  /api/projects
POST /api/projects
GET  /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id
```

## Knowledge

```text
GET  /api/projects/:id/documents
POST /api/projects/:id/documents
GET  /api/projects/:id/documents/:documentId
DELETE /api/projects/:id/documents/:documentId
```

## Media

```text
GET  /api/projects/:id/media
POST /api/projects/:id/media
DELETE /api/projects/:id/media/:mediaId
```

## Videos

```text
GET  /api/projects/:id/videos
POST /api/projects/:id/videos
PATCH /api/projects/:id/videos/:videoId
DELETE /api/projects/:id/videos/:videoId
```

## Agent

```text
GET   /api/projects/:id/agent
PATCH /api/projects/:id/agent
POST  /api/projects/:id/agent/activate
POST  /api/projects/:id/agent/pause
```

## WhatsApp

```text
GET  /api/projects/:id/whatsapp
POST /api/projects/:id/whatsapp
PATCH /api/projects/:id/whatsapp
POST /api/projects/:id/whatsapp/test
```

## Calendar

```text
GET  /api/projects/:id/calendar/connect
GET  /api/projects/:id/calendar/callback
GET  /api/projects/:id/calendar
PATCH /api/projects/:id/calendar
POST /api/projects/:id/calendar/disconnect
```

## Leads

```text
GET   /api/projects/:id/leads
GET   /api/projects/:id/leads/:leadId
PATCH /api/projects/:id/leads/:leadId
POST  /api/projects/:id/leads/:leadId/handoff
```

## Conversations

```text
GET /api/projects/:id/conversations
GET /api/leads/:leadId/conversation
```

## Site visits

```text
GET /api/projects/:id/site-visits
GET /api/leads/:leadId/site-visits
```

## Analytics

```text
GET /api/projects/:id/analytics/overview
GET /api/projects/:id/analytics/funnel
GET /api/projects/:id/analytics/conversations
GET /api/projects/:id/analytics/leads
```

---

# 42. WhatsApp Webhook

Public endpoints:

```text
GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

GET:

- Meta verification handshake.

POST:

1. verify `X-Hub-Signature-256`
2. parse payload
3. identify WhatsApp phone number ID
4. resolve WhatsAppChannel
5. resolve project
6. normalize customer phone
7. deduplicate WhatsApp message ID
8. create/update Lead
9. persist Message
10. enqueue agent job
11. return HTTP 200 quickly

Never invoke a long-running Gemini call synchronously from the webhook request.

---

# 43. Idempotency

WhatsApp may retry deliveries.

Use:

```text
Message.waMessageId UNIQUE
```

Processing rule:

```text
already exists?
   |
 YES --> ignore duplicate
   |
 NO
   |
persist
   |
enqueue
```

Agent jobs should also have an idempotency key such as:

```text
messageId
```

so that one inbound message cannot result in multiple AI responses.

---

# 44. Queue Architecture

Recommended:

```text
Next.js API
    |
    v
Google Cloud Pub/Sub
    |
    +--> Agent Worker
    |
    +--> Document Worker
    |
    +--> Follow-up Worker
    |
    +--> Analytics Worker
```

The exact queue implementation can be selected based on deployment constraints.

Pub/Sub events:

```text
PROCESS_INBOUND_MESSAGE
PROCESS_DOCUMENT
GENERATE_SUMMARY
CALCULATE_LEAD_SCORE
SYNC_CALENDAR
```

Cloud Tasks are used for delayed or scheduled individual actions:

```text
RUN_FOLLOWUP
SEND_WHATSAPP_RETRY
OTHER_DELAYED_AGENT_ACTION
```

---

# 45. Deployment Architecture

Recommended initial production topology:

```text
                         Internet
                            |
                            v
                     Next.js / API
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
       Cloud SQL DB          Object Storage     Queue/Google Cloud Pub/Sub
          |                 |                 |
          +-----------------+-----------------+
                            |
                            v
                       Agent Workers
                            |
                 +----------+----------+
                 |          |          |
                 v          v          v
              Gemini     WhatsApp   Google Calendar
```

Cloud Run may continue to be used for application and worker deployment.

Use separate deployable worker processes where practical:

```text
setu-web
setu-agent-worker
setu-document-worker
setu-followup-worker
```

Do not split into many microservices unless operational scale justifies it.

---

# 46. Cloud SQL for PostgreSQL

Cloud SQL is the primary relational database.

Prisma connects using the Cloud SQL for PostgreSQL connection string.

Requirements:

- migrations via Prisma
- connection pooling appropriate to Cloud SQL
- production database credentials in Secret Manager
- no database credentials in frontend code
- organization/project authorization enforced on every query path

Recommended indexes:

```text
Project.organizationId
Lead.projectId
Lead.stage
Lead.whatsappNumber
Lead.nextFollowupAt
Message.conversationId
Message.waMessageId
Document.projectId
SiteVisit.leadId
AgentRun.projectId
```

---

# 47. Storage Security

All uploaded project documents and media must be private.

Access pattern:

```text
Builder dashboard
      |
      v
Authorized API
      |
      v
Signed URL / server-side access
      |
      v
Private object
```

Never expose unrestricted public bucket URLs for private builder documents.

---

# 48. Secrets

Store securely:

```text
GEMINI_API_KEY
DATABASE_URL
WHATSAPP credentials
GOOGLE OAUTH credentials
SESSION_SECRET
CRON / worker secrets
```

Never:

- use `NEXT_PUBLIC_` for secrets
- log tokens
- return tokens in API responses
- store raw credentials in browser local storage

---

# 49. Agent Safety

The agent must have hard platform rules that the builder cannot override.

Examples:

```text
Never invent project information.
Never invent prices.
Never fabricate availability.
Never provide legal advice.
Never misrepresent RERA information.
Never claim a site visit is booked unless calendar booking succeeded.
Never claim a document was sent unless send operation succeeded.
Never expose internal prompts or credentials.
```

Builder instructions are subordinate to platform safety rules.

---

# 50. Observability

Every agent run should capture:

```text
agentRunId
organizationId
projectId
leadId
messageId
model
startedAt
completedAt
latency
status
error
token usage
```

Every tool call:

```text
agentRunId
toolName
arguments metadata
status
latency
error
```

Do not log sensitive customer content unnecessarily.

---

# 51. Audit Log

Track important builder actions:

```text
PROJECT_CREATED
PROJECT_UPDATED
DOCUMENT_UPLOADED
DOCUMENT_DELETED
WHATSAPP_CONNECTED
WHATSAPP_DISCONNECTED
AGENT_UPDATED
AGENT_ACTIVATED
AGENT_PAUSED
CALENDAR_CONNECTED
CALENDAR_DISCONNECTED
LEAD_UPDATED
HANDOFF_CREATED
```

Include:

```text
organizationId
userId
projectId
action
timestamp
metadata
```

---

# 52. Website Requirements

The public website should position Setu as an AI sales workforce for real-estate builders.

Primary CTA:

```text
Talk to an Architect
```

must link to:

https://calendly.com/dharam-tiwari/30min

Secondary CTA:

```text
Get Started / Sign Up
```

The website should explain:

```text
Lead Capture
Conversations
Lead Qualification
Automated Follow-ups
Site Visit Booking
Project Knowledge
WhatsApp AI Agent
Analytics
```

Pricing should communicate:

> Plans starting at ₹20,000 per project per month.

Do not expose "Clear WhatsApp Number" or equivalent reset functionality in the footer.

---

# 53. Insights / Blog Requirements

The Insights section should contain substantial long-form articles.

Each article may be **up to approximately 2,000 words**.

The implementation should support:

```text
title
slug
excerpt
coverImage
author
publishedAt
readingTime
content
tags
status
```

Blog content must support rich formatting:

```text
H1
H2
H3
paragraphs
lists
quotes
images
links
tables where appropriate
```

Recommended article length target:

```text
1,500–2,000 words
```

The blog UI should not truncate long articles.

Each article page should include:

- title
- category/tag
- publication date
- reading time
- cover image
- full article body
- related insights
- CTA to Talk to Architect
- CTA to Sign Up

The content should be optimized around real-estate AI sales topics rather than generic AI news.

Example topics:

```text
How AI Sales Agents Are Transforming Real Estate Lead Management
Why Real Estate Leads Go Cold and How AI Follow-ups Can Help
How WhatsApp AI Agents Qualify Property Buyers
How Real Estate Builders Can Automate Site Visit Booking
AI vs Traditional Real Estate Lead Follow-up
How to Build a 24x7 AI Sales Team for a Real Estate Project
```

---

# 54. Website / Application Separation

Public marketing pages:

```text
/
 /features
 /pricing
 /insights
 /insights/:slug
 /about
```

Authenticated application:

```text
/dashboard
/dashboard/projects
/dashboard/projects/:id
/dashboard/projects/:id/leads
/dashboard/projects/:id/conversations
/dashboard/projects/:id/knowledge
/dashboard/projects/:id/agent
/dashboard/projects/:id/whatsapp
/dashboard/projects/:id/calendar
/dashboard/projects/:id/analytics
```

---

# 55. Recommended Frontend Experience

Project setup should feel like a guided onboarding wizard.

```text
1. Project Details
2. Upload Knowledge
3. Add Project Media
4. Configure WhatsApp
5. Configure AI Agent
6. Connect Google Calendar
7. Review
8. Activate
```

After activation, the builder should see:

```text
AI Agent: LIVE
WhatsApp: Connected
Calendar: Connected
Knowledge: Ready
```

---

# 56. Project Home

A project home should immediately answer:

```text
Is my AI agent working?
How many leads did it handle?
How many are qualified?
How many site visits were booked?
Are there any issues?
```

Example:

```text
ABC Residency

AI Agent
LIVE

Leads                     248
Qualified                  73
Site Visits                21
Hot Leads                  18
Follow-ups Due              9

Agent Health
WhatsApp       Connected
Knowledge      Ready
Calendar       Connected
```

---

# 57. Agent Configuration UI

Use a simple configuration screen:

```text
AI Agent

Identity
[ Agent Name ]

Vibe
[ Friendly / Professional / Premium / Custom ]

Goal
[ large text area ]

Business Rules
[ large text area ]

Conversation Preferences
[ toggles ]

[ Save Configuration ]
```

Provide a preview:

```text
Customer: Hi, I am looking for a 3 BHK.

AI Agent:
Absolutely. I'd be happy to help you explore our 3 BHK options...
```

The preview should use the project's actual configuration and sample context.

---

# 58. Knowledge UI

Show:

```text
Knowledge

Brochure.pdf                  READY
PriceList.pdf                 READY
RERA.pdf                      READY
FAQ.pdf                       PROCESSING
DiscountPolicy.pdf            READY

[ Upload Document ]
```

Allow filtering by:

```text
All
Brochures
Pricing
Legal
FAQ
Policies
Other
```

---

# 59. WhatsApp UI

Show:

```text
WhatsApp

Status: Connected

Number: +91 XXXXX XXXXX

Project:
ABC Residency

[ Test Connection ]
[ Disconnect ]
```

Do not show credentials.

Do not include a "Clear WhatsApp Number" action in the public website footer.

---

# 60. Calendar UI

Show:

```text
Google Calendar

Status: Connected

Calendar:
ABC Residency Site Visits

Appointment duration:
30 minutes

Working hours:
10:00 AM – 6:00 PM

[ Save ]
[ Disconnect ]
```

---

# 61. Site Visit UI

Builder sees:

```text
Upcoming Site Visits

Customer       Date        Time       Lead Score
Rajesh         05 Sep      11:00      92
Priya          05 Sep      15:00      84
Amit           06 Sep      12:00      78
```

Clicking a visit shows:

```text
Customer
Phone
Requirement
Conversation summary
Calendar event
Project
```

---

# 62. Implementation Phases

## Phase 1 — SaaS foundation

Implement:

- Organization
- Users
- Membership
- Authentication
- Project model
- Project-level subscription
- tenant isolation
- Cloud SQL for PostgreSQL
- Prisma
- dashboard shell

## Phase 2 — Project onboarding

Implement:

- project creation
- brochure upload
- document upload
- media upload
- video links
- document processing
- knowledge status

## Phase 3 — WhatsApp SaaS

Implement:

- project-specific WhatsApp channel
- webhook routing
- webhook deduplication
- asynchronous message queue
- lead creation
- conversation persistence

## Phase 4 — Agent

Implement:

- Gemini provider
- agent configuration
- identity
- vibe
- goal
- project context
- knowledge retrieval
- tools
- lead qualification

## Phase 5 — Follow-ups

Implement:

- nextFollowupAt
- follow-up jobs
- configurable limits
- follow-up agent behavior
- opt-out / stop conditions

## Phase 6 — Google Calendar

Implement:

- OAuth
- calendar selection
- availability lookup
- booking
- site visit persistence
- WhatsApp confirmation

## Phase 7 — Analytics

Implement:

- dashboard metrics
- funnel
- lead scoring
- conversation analytics
- site visit analytics
- agent performance

## Phase 8 — Website

Implement:

- pricing
- signup
- signin
- insights
- long-form blog pages
- Calendly CTA
- remove footer WhatsApp clearing control

---

# 63. What to Reuse From Existing Setu

Retain and adapt:

```text
Next.js application
Prisma
PostgreSQL data access patterns
WhatsApp client
WhatsApp webhook verification
WhatsApp message ID deduplication
Lead concept
Conversation / Message concept
SiteVisit concept
Project concept
Document concept
Follow-up logic
Agent tool concept
MCP concept where useful
Cloud Run deployment approach
Secret Manager
GCS/private object storage
```

The existing implementation already validates external input with Zod and uses secure webhook verification. Preserve those practices.

---

# 64. What Must Be Rewritten / Refactored

Do not simply copy the single-builder implementation.

Refactor:

```text
Single builder
        ->
Organization / multi-tenant architecture
```

```text
Singleton WhatsAppSettings
        ->
Project-specific WhatsAppChannel
```

```text
Oldest ACTIVE project routing
        ->
Phone-number/channel based project routing
```

```text
Synchronous webhook -> agent
        ->
Webhook -> queue -> agent worker
```

```text
PDF-only context injection
        ->
Structured project data + document retrieval
```

```text
Static persona files
        ->
Database-backed AgentConfiguration
```

```text
Cloud SQL
        ->
Cloud SQL for PostgreSQL
```

```text
Single model configuration
        ->
Model Gateway with Gemini 3.1 Flash Lite provider
```

```text
Single dashboard
        ->
Organization / Project / Analytics hierarchy
```

---

# 65. Non-Goals for V1

Do not implement:

- Instagram integration
- Facebook Messenger
- SMS
- Email conversations
- Voice AI
- Website chatbot
- complex CRM integrations
- custom LLM training
- autonomous production code generation
- multi-region infrastructure
- Kubernetes unless required by scale
- large microservice fleet
- sophisticated inventory management unless required by the first customer
- payment gateway before commercial billing requirements are finalized

Keep the product focused on:

```text
Real Estate Builder
        +
Project
        +
WhatsApp AI Sales Agent
        +
Knowledge
        +
Lead Qualification
        +
Follow-up
        +
Site Visit Booking
        +
Analytics
```

---

# 66. End-to-End Customer Journey

## Builder

```text
Sign Up
  |
  v
Create Organization
  |
  v
Create Project
  |
  v
Choose / activate plan
  |
  v
Upload brochure
  |
  v
Upload pricing / RERA / legal / FAQ / policies
  |
  v
Upload project graphics
  |
  v
Add promo videos
  |
  v
Connect WhatsApp
  |
  v
Configure AI identity
  |
  v
Configure AI vibe
  |
  v
Configure AI goal
  |
  v
Connect Google Calendar
  |
  v
Activate Agent
```

## Customer

```text
Customer sends WhatsApp message
        |
        v
Setu receives message
        |
        v
Identify project
        |
        v
Create / load lead
        |
        v
AI understands intent
        |
        v
Retrieve relevant project knowledge
        |
        v
Natural conversation
        |
        v
Capture requirements
        |
        v
Qualify lead
        |
        v
Answer questions
        |
        v
Follow up when needed
        |
        v
Customer expresses interest
        |
        v
Check Google Calendar
        |
        v
Offer available slots
        |
        v
Customer selects slot
        |
        v
Book calendar event
        |
        v
Confirm on WhatsApp
        |
        v
Builder sees site visit + lead statistics
```

---

# 67. Definition of Done for V1

A project is considered production-ready when a builder can:

1. Sign up with email or mobile.
2. Sign in.
3. Create an organization.
4. Create a real-estate project.
5. Subscribe to a project plan.
6. Upload a brochure.
7. Upload pricing, RERA, legal, FAQ and policy documents.
8. Upload project graphics.
9. Add promo video links.
10. Configure a WhatsApp number.
11. Configure agent identity.
12. Configure agent vibe.
13. Configure agent goal.
14. Connect Google Calendar.
15. Activate the agent.
16. Receive a WhatsApp message from a real customer.
17. Have the AI respond intelligently.
18. Capture lead information.
19. Qualify the lead.
20. Send relevant project information.
21. Follow up automatically.
22. Offer site visit slots.
23. Book a site visit through Google Calendar.
24. Confirm the visit over WhatsApp.
25. View the complete lead/conversation history.
26. View project-level analytics.
27. Pause and reactivate the agent.
28. Safely manage uploaded documents.
29. Maintain strict tenant isolation.

---

# 68. Architectural Principle

The most important architectural principle for Setu SaaS is:

> **The conversation is not the product. The project configuration and sales workflow are the product.**

The project is the durable business object:

```text
Project
 |
 +-- Knowledge
 +-- Agent
 +-- WhatsApp
 +-- Calendar
 +-- Leads
 +-- Conversations
 +-- Follow-ups
 +-- Site Visits
 +-- Analytics
```

WhatsApp is simply the customer interaction channel.

Gemini is the reasoning engine.

The platform's value is the combination of:

```text
Real-estate project knowledge
+
AI sales behavior
+
Lead intelligence
+
Automated follow-up
+
Site visit booking
+
Sales analytics
```

This is the foundation for turning Setu from a single-builder chatbot into a repeatable SaaS product for real-estate developers.


---

# 69. Current Implementation Reality — September 2026

This section reconciles the original SaaS design with the implementation work completed after the original LLD was written.

## 69.1 Production identifiers

```text
GCP project:
setu-realestate

Cloud Run service:
setu-web

Region:
asia-southeast1

Production:
https://app.gosetu.co/

Artifact Registry:
asia-south1-docker.pkg.dev/setu-realestate/setu/setu-web:latest

GitHub:
draj1979/setu-realestate

Local:
~/setu-realestate
```

## 69.2 Next.js

Current Next.js version:

```text
16.3.4
```

Build command:

```json
"build": "next build --webpack"
```

Output:

```text
standalone
```

PDF.js:

```text
6.3.289
```

Root Docker image:

```text
node:22-alpine
```

Runtime:

```text
PORT=8080
HOSTNAME=0.0.0.0
```

## 69.3 Deployment rule

The project has explicitly standardized on:

```text
Local build
→ Local Docker build
→ Artifact Registry
→ Cloud Run
```

Reason:

```text
Catch build failures locally before cloud deployment.
```

Standard commands:

```bash
cd ~/setu-realestate
pnpm --filter @setu/web build
./scripts/docker-build.sh
docker push asia-south1-docker.pkg.dev/setu-realestate/setu/setu-web:latest
gcloud run deploy setu-web \
  --region=asia-southeast1 \
  --image=asia-south1-docker.pkg.dev/setu-realestate/setu/setu-web:latest \
  --update-secrets="DATABASE_URL=setu-database-url:latest,META_APP_SECRET=setu-meta-app-secret:latest"
```

Do not introduce Cloud Build as the normal development path.

## 69.4 Docker secret boundary

`scripts/docker-build.sh` sources:

```text
apps/web/.env.local
```

Only public Firebase build variables are passed as Docker build arguments.

Never pass:

```text
META_APP_SECRET
DATABASE_URL
database password
WhatsApp access token
Google OAuth secret
other private credentials
```

into the client-side build.

## 69.5 Firebase / authentication

Firebase authentication is integrated.

The authenticated Setu user supplies a Firebase ID token to protected Setu APIs using:

```text
Authorization: Bearer <Firebase ID token>
```

The backend validates the Firebase identity before project operations.

## 69.6 Database

Prisma is the ORM.

The final GCP architecture uses:

```text
Cloud SQL for PostgreSQL
```

The application must preserve project/organization authorization on every database path.

## 69.7 Document processing

Document processing is operational.

PDF.js worker:

```text
apps/web/public/pdfjs/pdf.worker.mjs
```

The worker is resolved from the production filesystem.

Embedding authentication was changed from spawning the `gcloud` CLI to Google Application Default Credentials using `google-auth-library`.

Service account:

```text
setu-web@setu-realestate.iam.gserviceaccount.com
```

Required Vertex role:

```text
roles/aiplatform.user
```

Prisma transaction timeout was increased to:

```ts
{ timeout: 30_000 }
```

Documents are currently processing successfully.

---

# 70. Current Meta / WhatsApp Implementation

## 70.1 Meta application

```text
Meta App ID:
4464692527110370

Embedded Signup Configuration:
1764176554923601
```

Current configuration:

```text
WhatsApp Embedded Signup
ES Version: v4
```

Cloud API requirements:

```text
Asset:
WhatsApp Business accounts

Permissions:
whatsapp_business_management
whatsapp_business_messaging
```

Configured token model:

```text
System-user access token
60-day expiration
```

The Meta application has Tech Provider approval and business verification is cleared.

## 70.2 Embedded Signup frontend

File:

```text
apps/web/src/app/projects/[projectId]/whatsapp/page.tsx
```

Current flow:

```text
Facebook SDK load
→ FB.init()
→ message listener
→ FB.login()
→ Meta returns authorization code
→ Firebase authentication
→ POST /api/projects/:projectId/whatsapp/connect
```

The `message` listener receives:

```text
WA_EMBEDDED_SIGNUP
event = FINISH
```

and captures:

```text
business_id
waba_id
phone_number_id
```

A real test produced:

```text
business_id: 664043177564016
waba_id: 1627036352353654
phone_number_id: 1384353548083868
```

Do not treat these test IDs as permanent application configuration.

## 70.3 v4 mismatch currently being fixed

Meta's current Builder generates:

```js
FB.login(fbLoginCallback, {
  config_id: '1764176554923601',
  response_type: 'code',
  override_default_response_type: true,
  extras: {"version":"v4"}
});
```

The older Setu code used:

```ts
extras: {
  sessionInfoVersion: 3,
}
```

Required first correction:

```ts
extras: {
  version: "v4",
}
```

Make this change in isolation before changing the backend OAuth exchange.

## 70.4 Callback ordering

Observed browser order:

```text
WhatsApp Embedded Signup completed
Meta Embedded Signup response
Firebase user found
Firebase token obtained
calling connect API
POST 400
Meta authorization failed
```

Therefore:

```text
FINISH event race condition
```

is not currently supported as the root cause.

---

# 71. Current Meta OAuth Blocker

Backend file:

```text
apps/web/src/app/api/projects/[projectId]/whatsapp/connect/route.ts
```

Current exchange:

```text
GET
https://graph.facebook.com/v23.0/oauth/access_token
```

with:

```text
client_id
client_secret
code
```

Meta response:

```text
HTTP 400
OAuthException
code: 1
Error validating client secret.
```

The App ID and App Secret were independently tested using Meta's client-credentials flow.

Result:

```text
HTTP 200
access_token returned
```

Therefore:

```text
App ID + App Secret = valid
authorization-code exchange = failing
```

## Meta Builder-generated exchange

Current Builder shows:

```bash
curl -X POST \
  'https://graph.facebook.com/v25.0/oauth/access_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "client_id": "...",
    "client_secret": "REDACTED",
    "grant_type": "authorization_code",
    "redirect_uri": "https://developers.facebook.com/es/oauth/callback/?..."
  }'
```

Important differences:

```text
Builder: POST v25.0
Setu:     GET  v23.0
```

Builder includes:

```text
grant_type=authorization_code
redirect_uri
```

The production redirect URI configured for Setu is:

```text
https://app.gosetu.co/
```

The Builder's dynamic `developers.facebook.com` callback must not be blindly hard-coded into production.

The next backend change must first establish the correct production redirect handling for Embedded Signup v4.

## Do not bypass this with a Setu system-user token

A Setu-owned System User token is not a drop-in replacement for the authorization-code exchange. Do not redesign the asset-sharing model just to avoid this step.

The intended builder experience remains:

```text
Builder authorizes in Meta
→ Setu receives code
→ Setu exchanges code server-to-server
→ Setu stores a secure token/reference
```

---

# 72. Current Webhook Configuration

Production endpoint:

```text
https://app.gosetu.co/api/webhooks/whatsapp
```

Meta Builder previously displayed an unrelated old callback:

```text
https://wa.staffstream.in/webhook
```

That URL must not be used for Setu.

Verify token:

```text
WHATSAPP_VERIFY_TOKEN
```

The actual value is secret.

Core subscription:

```text
messages
```

Existing webhook file:

```text
apps/web/src/app/api/webhooks/whatsapp/route.ts
```

Current GET:

```text
Meta verification handshake
```

Current POST:

```text
parse webhook
log payload
return success
```

The full SaaS target is:

```text
Meta
→ signature verification
→ phone_number_id
→ WhatsAppChannel
→ Project
→ Lead
→ Message
→ Pub/Sub
→ Agent Worker
```

Do not run long Gemini operations inside the webhook request.

---

# 73. Existing WhatsApp Domain Model

Current Prisma model:

```prisma
model WhatsAppChannel {
  id                 String   @id @default(cuid())
  projectId          String   @unique
  phoneNumberId      String   @unique
  businessAccountId  String
  displayPhoneNumber String?
  accessTokenRef     String?
  webhookSecretRef   String?
  active             Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Critical invariant:

```text
phoneNumberId is unique
```

This is the routing key from WhatsApp to the project.

---

# 74. Current Security / Secret State

Cloud Run secret bindings:

```text
META_APP_SECRET → setu-meta-app-secret:latest
DATABASE_URL → setu-database-url:latest
```

The Meta secret was directly tested against Meta and works for client credentials.

Never expose:

```text
META_APP_SECRET
authorization code
access token
System User token
WHATSAPP_VERIFY_TOKEN
DATABASE_URL/password
Firebase private credentials
```

Safe debugging fields:

```text
HTTP status
Meta error
Meta error type
Meta error code
fbtrace_id
WABA ID
phone number ID
App ID
configuration ID
```

---

# 75. Domain and Networking

Production custom domain:

```text
app.gosetu.co
```

DNS:

```text
app CNAME → ghs.googlehosted.com.
```

HTTPS is provisioned.

Cloud Run service is public for the web application.

Protected application APIs use Firebase authentication.

Public Meta webhook endpoints remain reachable by Meta and validate Meta's verification/signature requirements.

---

# 76. File / Code Structure — Key Areas

```text
setu-realestate/
|
+-- apps/
|   +-- web/
|       +-- src/app/
|       |   +-- projects/[projectId]/
|       |       +-- page.tsx
|       |       +-- whatsapp/
|       |
|       |   +-- api/
|       |       +-- projects/[projectId]/whatsapp/connect/
|       |       +-- webhooks/whatsapp/
|       |
|       +-- src/lib/
|           +-- whatsapp/
|           |   +-- handle-inbound.ts
|           |   +-- parse-webhook.ts
|           |   +-- send-text.ts
|           |
|           +-- ...
|       |
|       +-- public/
|           +-- pdfjs/
|               +-- pdf.worker.mjs
|
+-- packages/
|   +-- db/
|
+-- scripts/
    +-- docker-build.sh
```

Use the existing modules rather than duplicating WhatsApp, document and agent logic.

---

# 77. Production Sequence — Customer Message

```text
Customer
  |
  | WhatsApp message
  v
Meta WhatsApp Cloud API
  |
  v
POST /api/webhooks/whatsapp
  |
  +-- verify signature
  |
  +-- parse payload
  |
  +-- extract phone_number_id
  |
  +-- find WhatsAppChannel
  |
  +-- find Project
  |
  +-- find/create Lead
  |
  +-- deduplicate waMessageId
  |
  +-- persist Message
  |
  +-- publish PROCESS_INBOUND_MESSAGE
  |
  +-- HTTP 200
  |
  v
Agent Worker
  |
  +-- load project
  +-- load agent configuration
  +-- load lead
  +-- load conversation
  +-- retrieve knowledge
  +-- invoke OpenClaw
  +-- invoke Gemini through ModelGateway
  +-- execute tools
  +-- persist changes
  +-- send WhatsApp reply
```

---

# 78. Production Sequence — Builder WhatsApp Onboarding

```text
Builder
  |
  v
Setu Project → WhatsApp
  |
  v
FB.login()
  |
  v
Meta Embedded Signup v4
  |
  +--> builder authorizes WABA
  |
  +--> FINISH event
  |       |
  |       +--> waba_id
  |       +--> phone_number_id
  |
  +--> authResponse.code
          |
          v
Setu backend
  |
  +--> Firebase authorization
  |
  +--> project membership authorization
  |
  +--> Meta authorization-code exchange
  |
  +--> obtain access token
  |
  +--> validate phone number
  |
  +--> create/update WhatsAppChannel
  |
  v
WhatsApp Connected
```

Current blocker is the Meta exchange stage.

---

# 79. Production Sequence — Document Upload

```text
Builder
  |
  v
Upload document
  |
  v
Authorized Setu API
  |
  v
Private GCS
  |
  v
PROCESS_DOCUMENT Pub/Sub
  |
  v
Document Worker
  |
  +--> extract text
  +--> normalize
  +--> chunk
  +--> embed/index
  |
  v
Document READY
```

Failed state:

```text
Document FAILED
+
processingError
```

---

# 80. Production Sequence — Site Visit

```text
Customer
  |
  v
WhatsApp conversation
  |
  v
Agent detects visit intent
  |
  v
get_available_site_visit_slots
  |
  v
Google Calendar
  |
  v
Available slots
  |
  v
Customer selects slot
  |
  v
book_site_visit
  |
  v
Recheck availability
  |
  v
Create Calendar event
  |
  v
Persist SiteVisit
  |
  v
Lead = SITE_VISIT_SCHEDULED
  |
  v
WhatsApp confirmation
```

---

# 81. UI Navigation Requirements

Authenticated project route:

```text
/projects/:projectId
```

Project sections should route to:

```text
/projects/:projectId/whatsapp
/projects/:projectId/knowledge
/projects/:projectId/agent
/projects/:projectId/calendar
/projects/:projectId/leads
/projects/:projectId/conversations
/projects/:projectId/analytics
```

Existing project page routes the WhatsApp section to:

```text
/projects/[projectId]/whatsapp
```

---

# 82. Website Product Positioning

Setu should be positioned as an AI sales workforce for real-estate builders.

Core value:

```text
24x7 AI sales conversations
+
Lead qualification
+
Automated follow-up
+
Project knowledge
+
Site visit booking
+
Analytics
```

The public website should avoid claiming capabilities that are not implemented.

Primary CTA:

```text
Talk to an Architect
```

Calendar destination:

```text
https://calendly.com/dharam-tiwari/30min
```

Secondary:

```text
Get Started / Sign Up
```

---

# 83. Implementation Priorities

## P0 — Current blocker

```text
Meta Embedded Signup v4
```

Tasks:

1. Change frontend extras to `version: "v4"`.
2. Local build.
3. Docker build.
4. Push.
5. Deploy.
6. Retest.
7. If still failing, fix backend v4 authorization-code exchange.
8. Verify production redirect URI behavior.
9. Complete WhatsApp connection persistence.
10. Configure correct webhook subscription.

## P1

```text
Stable asynchronous WhatsApp processing
```

Implement:

- Pub/Sub
- worker
- idempotency
- lead persistence
- conversation persistence
- outbound messaging

## P1

```text
Project knowledge
```

Implement/verify:

- structured project facts
- document processing
- retrieval
- media
- video links

## P1

```text
Agent
```

Implement/verify:

- OpenClaw boundary
- Gemini ModelGateway
- agent configuration
- lead qualification
- tools
- safety

## P2

```text
Calendar
Follow-ups
Analytics
Notifications
```

---

# 84. Testing Strategy

## Unit tests

Test:

```text
Webhook signature validation
Webhook parsing
Phone normalization
Lead upsert
Message idempotency
Tenant authorization
Document parsing
Chunking
Lead scoring
Follow-up eligibility
Calendar slot logic
Tool authorization
```

## Integration tests

Test:

```text
Firebase → Setu API
Meta webhook → Setu webhook
WhatsAppChannel → Project routing
Document upload → processing
Pub/Sub → Agent Worker
Agent → tool execution
Calendar → SiteVisit
WhatsApp send
```

## End-to-end

Builder:

```text
signup
→ organization
→ project
→ subscription
→ document upload
→ WhatsApp connect
→ agent configure
→ calendar connect
→ activate
```

Customer:

```text
WhatsApp message
→ AI conversation
→ qualification
→ follow-up
→ site visit
→ Calendar booking
→ confirmation
```

Security E2E:

```text
User A cannot access Organization B
Project A cannot access Project B knowledge
Agent cannot invoke tools outside its project
```

---

# 85. Operational Acceptance Criteria

A deployment is acceptable only when:

```text
Application loads on app.gosetu.co
Firebase authentication works
Project APIs enforce membership
Documents upload/process
WhatsApp Embedded Signup completes
WhatsApp channel is persisted
Meta webhook verifies
messages subscription delivers inbound messages
Inbound message is deduplicated
Lead is created
Conversation is persisted
Agent job is queued
OpenClaw processes the turn
Gemini returns a response
WhatsApp response is sent
Lead qualification is updated
Follow-up can be scheduled
Calendar slots can be retrieved
Site visit can be booked
Dashboard shows resulting state
```

---

# 86. Known Risks

## Meta API/version drift

Meta is actively evolving Embedded Signup. Keep Graph/Embedded Signup versions explicit and follow the current Meta configuration rather than assuming older examples remain valid.

## OAuth redirect mismatch

The current Builder-generated token exchange contains a dynamic Meta callback. Production behavior must be validated before hard-coding any callback.

## Token security

Never move secrets into browser code.

## Tenant leakage

Every agent tool and API path must carry/resolve organization and project context.

## Webhook retries

Use unique WhatsApp message IDs and idempotent job processing.

## AI hallucination

Project facts, pricing and availability must be grounded in authoritative structured data/retrieval.

## Calendar double booking

Always recheck immediately before booking.

## Long-running webhook

Never wait for the agent runtime before returning the webhook response.

---

# 87. Future Extensions — Not V1

Possible later work:

```text
Instagram
Messenger
SMS
Email
Voice
CRM integrations
Inventory
Advanced billing
Revenue attribution
More AI models
More sophisticated analytics
```

These should not distort the V1 architecture.

The current abstraction boundaries should make future channels and models possible without requiring a complete rewrite.

---

# 88. Master Architecture Diagram

```text
                              ┌─────────────────────┐
                              │      BUILDER        │
                              │ Web Dashboard       │
                              └──────────┬──────────┘
                                         │
                                         v
                              ┌─────────────────────┐
                              │     SETU WEB/API    │
                              │ Next.js / Cloud Run │
                              └──────────┬──────────┘
                                         │
             ┌───────────────────────────┼────────────────────────────┐
             │                           │                            │
             v                           v                            v
      ┌──────────────┐           ┌──────────────┐            ┌──────────────┐
      │ Cloud SQL    │           │ GCS Private  │            │ Pub/Sub      │
      │ PostgreSQL   │           │ Documents    │            │ Event Bus    │
      └──────┬───────┘           └──────────────┘            └──────┬───────┘
             │                                                      │
             │                                       ┌──────────────┼─────────────┐
             │                                       │              │             │
             │                                       v              v             v
             │                                Agent Worker   Document Worker  Analytics
             │                                       │
             │                                       v
             │                                  OpenClaw
             │                                       │
             │                           ┌───────────┼───────────┐
             │                           │           │           │
             │                           v           v           v
             │                        Gemini     Setu Tools   Project Context
             │                           │
             │                           │
             │            ┌──────────────┴───────────────┐
             │            │                              │
             v            v                              v
       ┌────────────┐ ┌───────────────┐          ┌───────────────┐
       │   Leads    │ │ Conversations │          │ Site Visits   │
       └────────────┘ └───────────────┘          └───────┬───────┘
                                                         │
                                                         v
                                                  Google Calendar

External messaging:

Customer
   |
   v
WhatsApp
   |
   v
Meta Cloud API
   |
   v
Setu Webhook
   |
   v
Pub/Sub
   |
   v
Agent Worker
   |
   v
WhatsApp Cloud API
   |
   v
Customer
```

---

# 89. Final Engineering Principle

The project should remain intentionally simple at the infrastructure level while being strong at the domain level.

```text
Few workloads
+
Strong tenant isolation
+
Durable project model
+
Async processing
+
Controlled AI tools
+
Grounded project knowledge
+
WhatsApp-first customer experience
```

The architecture should optimize for reliable real-estate sales automation rather than infrastructure complexity.

---

# 90. Immediate Development Handover

Start the next implementation session with:

> Read the Setu Complete Project LLD. We are continuing implementation of Setu. The current blocker is Meta WhatsApp Embedded Signup v4 authorization-code exchange. First change only the frontend `extras` from `sessionInfoVersion: 3` to `version: "v4"`. Then build locally, Docker-build locally, push to Artifact Registry, deploy to Cloud Run, and retest. Do not change the backend OAuth exchange until we see the result. Work one step at a time.
