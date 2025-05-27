<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Trace Viewer Enhancements

This document outlines planned enhancements to transform the basic trace timeline into a comprehensive, modern trace analysis tool optimized for VS Code and GraphQL development.

## Current State

**✅ PHASE 1 COMPLETE** - The trace viewer now includes:

- **Hierarchical span display** with proper indentation and parent-child relationships
- **Collapsible span groups** with expand/collapse toggles (▼/▶)
- **Rich details panel** showing comprehensive span information when clicked
- **Modern UI design** with VS Code theme integration and smooth animations
- **Enhanced span visualization** with gradient colors, hover effects, and error highlighting
- **Comprehensive attribute support** including arrays (e.g., `graphql.field.path`)
- **Performance metrics** including self-time calculations
- **Full window layout** for better visualization space

## Enhancement Goals

1. **✅ Look more professional** - Modern UI with visual depth and hierarchy
2. **🔄 Better functionality** - Rich details, navigation, and analysis features (Phase 1 ✅, Phase 2-3 in progress)
3. **⏳ VS Code integration** - Leverage the editor context for unique capabilities (Phase 2)
4. **⏳ GraphQL-specific features** - Tailored for StepZen's federation scenarios (Phase 2-3)

## Planned Features

### 1. Visual Hierarchy & Modern UI ✅ **COMPLETED**

- **✅ Nested span display** with proper indentation showing parent-child relationships
- **✅ Collapsible span groups** - click to expand/collapse children spans
- **✅ Modern timeline design** with visual depth (shadows, gradients, better typography)
- **✅ Span dependency lines** connecting parent spans to their children (via indentation)
- **⏳ Minimap overview** at the top showing the compressed full trace (Phase 3)
- **⏳ Zoom/pan controls** for navigating long traces (Phase 3)
- **✅ Responsive design** that adapts to panel width

### 2. Rich Span Details Panel ✅ **COMPLETED**

When clicking a span, display a detailed side panel containing:

- **✅ Full attributes** (complete OTEL attribute set, including arrays)
- **✅ Span events/logs** if present in the OpenTelemetry data
- **✅ Resource information** from the OTEL resource spans
- **✅ Performance metrics** including self-time vs total time calculations
- **✅ Error details** with full stack traces if the span failed
- **✅ Timing breakdown** showing time spent in this span vs children

### 3. VS Code Integration Features ⭐ (Unique Value) **🔄 PHASE 2 - IN PROGRESS**

- **✅ "Go to Schema" button** - navigate from a span to the GraphQL schema definition
- **✅ "Go to Resolver" link** - jump to the field resolver in the schema if the span represents field resolution
- **🔄 "View Query" action** - highlight the part of the GraphQL query this span represents (basic implementation)
- **⏳ Code lens integration** - show trace timing information directly in GraphQL files
- **⏳ Diagnostic correlation** - link spans to VS Code diagnostic messages
- **✅ File navigation** - open relevant schema files from trace context

### 4. Smart Filtering & Search **⏳ PHASE 3**

- **⏳ Filter by span type** (HTTP, database, resolver, materialization, etc.)
- **⏳ Search span names and attributes** with real-time filtering
- **⏳ Error-only view** - show/hide spans based on error status
- **⏳ Critical path highlighting** - identify and highlight the longest dependency chain
- **⏳ Duration thresholds** - filter spans above/below certain timing thresholds
- **⏳ Service filtering** - show spans from specific backend services only

### 5. Performance Analysis **⏳ PHASE 3**

- **⏳ Flame graph view** as an alternative visualization to the timeline
- **⏳ Service dependency map** showing which external services were called
- **⏳ Bottleneck identification** - automatically highlight the slowest spans
- **⏳ Parallel vs sequential execution** visualization
- **⏳ Waterfall analysis** - show request dependencies and blocking relationships
- **⏳ Performance recommendations** based on span patterns

### 6. GraphQL-Specific Features **⏳ PHASE 2-3**

- **⏳ Field resolution tree** that matches the GraphQL query structure
- **⏳ Materializer performance breakdown** showing data source efficiency
- **⏳ Data source attribution** - clearly show which spans hit which backends
- **⏳ Query complexity correlation** with execution timing
- **⏳ Schema coverage** - show which parts of the schema were exercised
- **⏳ Federation insights** - highlight cross-service calls and their costs

## Implementation Approach

### Phase 1: Visual Hierarchy + Details Panel ✅ **COMPLETED**

**Goal**: Make it look professional and show comprehensive span information

**Tasks**:

- **✅ Implement nested span display with proper indentation**
- **✅ Add collapsible span groups (expand/collapse children)**
- **✅ Create a details panel that appears when clicking spans**
- **✅ Modernize the CSS with better typography, spacing, and visual hierarchy**
- **✅ Add span dependency lines connecting parents to children**
- **✅ Improve the timeline visualization with better colors and styling**

**Deliverables**:

- **✅ Enhanced `trace-viewer.js` with hierarchical rendering**
- **✅ New CSS for modern styling and layout**
- **✅ Interactive details panel component**
- **✅ Improved span selection and highlighting**

**Additional Achievements**:

- **✅ Full window layout** for better visualization space
- **✅ Array attribute support** for complex OTEL data
- **✅ Self-time calculations** for performance analysis
- **✅ Error span highlighting** with pulse animation
- **✅ Responsive design** for different panel sizes

### Phase 2: VS Code Navigation Integration **🔄 CURRENT PHASE**

**Goal**: Leverage VS Code context for unique developer experience

**Tasks**:

- **✅ Add message passing between webview and extension**
- **✅ Implement "Go to Schema" functionality**
- **✅ Create span-to-code navigation features**
- **⏳ Add code lens integration for timing display**
- **⏳ Implement diagnostic correlation**

**Deliverables**:

- **✅ Webview-to-extension communication protocol**
- **✅ Schema navigation commands**
- **⏳ Code lens enhancements**
- **⏳ Diagnostic integration**

**Phase 2 Progress Summary**:

- **✅ Message Passing Infrastructure**: Complete webview-to-extension communication
- **✅ Navigation Buttons**: Added "Go to Schema Definition" button with alias resolution
- **✅ Field Path Resolution**: Smart GraphQL field path parsing with alias handling
- **✅ Schema Integration**: Uses existing schema index service for navigation
- **✅ UI Enhancement**: Professional action button with VS Code theming
- **✅ Error Handling**: Comprehensive error handling with user feedback
- **✅ Alias Support**: Resolves GraphQL aliases to actual field names using span names

### Phase 3: Advanced Analysis Features **⏳ FUTURE**

**Goal**: Provide professional-grade trace analysis capabilities

**Tasks**:

- **⏳ Implement filtering and search functionality**
- **⏳ Add performance analysis features (bottleneck detection, critical path)**
- **⏳ Create alternative visualizations (flame graph, service map)**
- **⏳ Add GraphQL-specific analysis features**
- **⏳ Implement zoom/pan and minimap for large traces**

**Deliverables**:

- **⏳ Advanced filtering UI**
- **⏳ Performance analysis algorithms**
- **⏳ Alternative visualization modes**
- **⏳ GraphQL-aware analysis features**

## Technical Considerations

### Architecture

- **✅ Maintain the current React-based approach for consistency**
- **✅ Use CSS custom properties for theming to match VS Code**
- **⏳ Implement efficient rendering for large traces (virtualization if needed)**
- **✅ Design for extensibility to add new span types and analysis features**

### Performance

- **⏳ Lazy loading for large trace datasets**
- **✅ Efficient DOM updates when filtering/searching**
- **⏳ Debounced search and filter operations**
- **✅ Memory-conscious span data processing**

### Accessibility

- **✅ Keyboard navigation support**
- **✅ Screen reader compatibility**
- **✅ High contrast mode support**
- **✅ Focus management for interactive elements**

### Integration Points

- **⏳ Extension message passing API**
- **⏳ Schema index service integration**
- **⏳ Diagnostic service correlation**
- **⏳ File navigation service usage**

## Success Metrics

- **✅ Visual Appeal**: Modern, professional appearance matching VS Code design language
- **✅ Functionality**: Comprehensive span analysis capabilities
- **⏳ Developer Experience**: Seamless navigation between trace and code
- **✅ Performance**: Smooth interaction with traces containing 100+ spans
- **⏳ Adoption**: Positive developer feedback and increased usage

## Phase 1 Achievements Summary

**What was delivered:**

- **Professional UI**: Modern design with gradients, animations, and VS Code theming
- **Hierarchical Display**: Proper nesting with 20px indentation per level
- **Interactive Features**: Collapsible spans, clickable elements, hover effects
- **Rich Details Panel**: Comprehensive span information with timing breakdown
- **Enhanced Data Processing**: Support for all OTEL attribute types including arrays
- **Performance Insights**: Self-time calculations and children summaries
- **Error Visualization**: Pulsing red animation for error spans
- **Full Window Layout**: Better space utilization for complex traces

**Impact:**

- Transformed from basic timeline to professional trace analysis tool
- Provides comprehensive span inspection capabilities
- Matches the quality of dedicated tracing tools like Jaeger
- Optimized for VS Code integration and GraphQL development workflows

## Phase 2 Achievements Summary

**What was delivered:**

- **Webview Communication**: Full bidirectional message passing between trace viewer and VS Code extension
- **Schema Navigation**: Click any GraphQL resolver span to jump directly to its schema definition
- **Smart Field Resolution**: Intelligent parsing of GraphQL field paths to resolve correct types and fields
- **Professional Action Buttons**: VS Code-themed buttons with hover effects and clear iconography
- **Field Path Display**: Visual representation of GraphQL field paths (e.g., "customer → orders")
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Schema Index Integration**: Leverages existing schema indexing service for accurate navigation
- **Responsive Design**: Action buttons adapt to different panel sizes

**Key Features:**

- **"Go to Schema Definition" Button**: Navigate from trace span to GraphQL field definition
- **Alias Resolution**: Handles GraphQL aliases by extracting actual field names from span names
- **Field Path Display**: Visual representation of GraphQL field paths (e.g., "customer → orders")
- **Field Path Resolution**: Handles both root fields (Query.customer) and nested fields (Customer.orders)
- **Type Resolution**: Smart type inference from parent field return types
- **VS Code Integration**: Seamless file navigation with cursor positioning and highlighting

**Technical Implementation:**

- **Message Protocol**: Structured command system for webview-extension communication
- **Field Path Parsing**: Robust parsing of OTEL `graphql.field.path` arrays
- **Schema Index Usage**: Integration with existing `services.schemaIndex` for field lookups
- **Error Recovery**: Graceful fallbacks when schema definitions aren't found
- **UI Consistency**: Matches VS Code design language and theming

**Impact:**

- Unique differentiation from generic trace viewers like Jaeger
- Seamless developer workflow from trace analysis to code editing
- Leverages VS Code's powerful editor capabilities for GraphQL development
- Provides context-aware navigation that understands GraphQL schema structure
- Reduces context switching between trace analysis and code editing

---

_Portions of the Content may be generated with the assistance of CursorAI_
