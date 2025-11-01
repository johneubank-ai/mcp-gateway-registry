# Issue #195 Sub-Tasks: Example Agents & Semantic Discovery

## Overview
Build example A2A agents that demonstrate:
1. Agent registration with the A2A Registry
2. Semantic search discovery of other agents
3. Agent-to-agent communication patterns
4. Integration with Strands and AgentCore

## Sub-Issues to Create

### 1. Build Analytics Agent (Strands-based)
**Objective**: Create a working example agent that showcases data analysis capabilities
- Demonstrates Strands agent framework integration with A2A
- Provides analytics/data processing skills
- Registers with the A2A Registry
- Uses semantic search to discover complementary agents
- **Acceptance Criteria**:
  - Agent follows A2A protocol specification
  - Successfully registers with registry
  - Exposes REST endpoint for agent discovery
  - Can be discovered via semantic search for "analytics", "data-processing"

### 2. Build Code Review Agent (AgentCore-based)
**Objective**: Create an example agent using AgentCore that performs code reviews
- Demonstrates AgentCore integration with A2A
- Provides code review and quality analysis skills
- Registers and discovers other agents (Analytics Agent)
- Shows direct P2P communication pattern
- **Acceptance Criteria**:
  - Agent follows A2A protocol specification
  - Successfully registers with registry
  - Exposes REST endpoint for agent discovery
  - Can discover Analytics Agent via semantic search
  - Demonstrates calling another agent's endpoint

### 3. Build Documentation Generator Agent
**Objective**: Create a simple example agent for documentation generation
- Demonstrates multi-agent collaboration
- Discovers and calls Code Review Agent for quality checks
- Discovers and calls Analytics Agent for metrics
- Shows orchestration pattern
- **Acceptance Criteria**:
  - Agent follows A2A protocol specification
  - Successfully registers with registry
  - Demonstrates discovering multiple agents via semantic search
  - Shows chained agent calls with proper error handling

### 4. Implement Semantic Search Discovery Pattern
**Objective**: Create example code showing how agents discover each other
- Demonstrate semantic search queries for agent discovery
- Show how agents query the registry for capabilities
- Implement agent discovery with skill matching
- **Acceptance Criteria**:
  - Example code for agent discovery queries
  - Demonstrates semantic search with vector embeddings
  - Shows skill/capability matching
  - Includes example conversations between agents

### 5. Create Agent Registration & Discovery Guide
**Objective**: Documentation for developers on how to build and register A2A agents
- Step-by-step guide for building A2A-compliant agents
- Instructions for registering agents with the registry
- Examples of using semantic search for discovery
- Integration guides for Strands and AgentCore
- **Acceptance Criteria**:
  - Comprehensive developer guide (markdown)
  - Code examples for each step
  - Registration workflow documented
  - Discovery patterns explained with examples

### 6. Create Integration Tests for Example Agents
**Objective**: Automated tests demonstrating agent registration and discovery
- Test agent registration flow
- Test semantic search discovery
- Test P2P communication between agents
- Test error handling and edge cases
- **Acceptance Criteria**:
  - Integration tests passing
  - Tests cover registration, discovery, and communication
  - Clear test output showing agent interactions
  - Edge cases documented

### 7. Create Agent Demo/Walkthrough Script
**Objective**: Interactive script demonstrating agents in action
- Script that:
  1. Registers example agents with the registry
  2. Performs semantic searches to discover agents
  3. Demonstrates direct P2P calls between agents
  4. Shows registry lookup workflow
- **Acceptance Criteria**:
  - Script runs end-to-end without manual intervention
  - Clear output showing each step
  - Demonstrates key A2A features
  - Can be used for demonstrations/tutorials

### 8. Implement A2A Agent Metrics & Analytics
**Objective**: Track agent discovery, usage patterns, and popularity metrics
- Build metrics collection for A2A agent interactions:
  - Agent discovery queries (what agents are being searched for)
  - Discovery success rates (agents found vs. searches)
  - Agent usage/invocation frequency
  - Popularity scores based on discovery and usage
  - Peer-to-peer communication patterns
- Integrate with existing metrics service (Prometheus + SQLite)
- Track in metrics database for historical analysis
- **Acceptance Criteria**:
  - Metrics collection for agent discovery and usage
  - Popularity scoring algorithm implemented
  - Historical data stored in metrics database
  - Can query and retrieve agent metrics via API

### 9. Visualize A2A Agent Metrics in Dashboard
**Objective**: Display agent metrics and insights in the existing UI
- Add dashboard widgets for A2A agents:
  - **Agent Popularity Ranking**: Top agents by usage/discovery frequency
  - **Discovery Trends**: Graph of discovery queries over time
  - **Agent Collaboration Network**: Show P2P communication patterns between agents
  - **Usage Analytics**: Agent invocation frequency, response times
  - **Discovery Heatmap**: Most searched agent capabilities/skills
  - **Agent Health & Activity**: Recent registrations, updates, last seen times
- Integrate with existing Grafana dashboards
- Leverage existing metrics infrastructure
- **Acceptance Criteria**:
  - At least 4 dashboard widgets implemented
  - Charts showing agent popularity, trends, and usage
  - Real-time metrics updates
  - Responsive design matching existing UI
  - Works with example agents

## Implementation Order
1. **Phase 1**: Analytics Agent (foundation)
2. **Phase 2**: Code Review Agent (Strands+AgentCore comparison)
3. **Phase 3**: Semantic Search Discovery Pattern (core capability)
4. **Phase 4**: Documentation Generator Agent (multi-agent orchestration)
5. **Phase 5**: Developer Guide & Tests (enablement)
6. **Phase 6**: Demo Script (show & tell)
7. **Phase 7**: Metrics & Analytics (observability)
8. **Phase 8**: Dashboard Visualization (insights)

## Success Metrics
- [ ] All example agents successfully register with registry
- [ ] Semantic search can discover agents by skills/tags
- [ ] Agents can discover and call each other
- [ ] Clear documentation for building new agents
- [ ] Integration tests passing
- [ ] Working demo showing complete workflow
- [ ] Agent metrics collected and stored in metrics database
- [ ] Dashboard displays agent popularity, trends, and usage analytics
- [ ] Discovery and usage patterns tracked and visualized

## Related
- Main Issue: #195 - Add A2A Protocol Support to Registry
- Design Doc: `.scratchpad/a2a-integration-design.md`
- A2A Protocol: https://a2a-protocol.org/

## Notes
- Keep examples simple and focused on demonstration
- Detailed implementation can be refined once #195 is fully implemented
- These examples will serve as templates for users building their own agents
- Focus on clear communication patterns and discovery mechanisms
- Metrics collection should leverage existing Prometheus + SQLite infrastructure
- Dashboard visualizations should integrate with Grafana and existing UI patterns
- Metrics enable understanding of agent ecosystem health, adoption, and usage patterns
