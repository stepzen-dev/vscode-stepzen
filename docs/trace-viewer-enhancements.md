<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Trace Viewer Enhancements

This document outlines planned enhancements to transform the basic trace timeline into a comprehensive, modern trace analysis tool optimized for VS Code and GraphQL development.

## Current State

The existing trace viewer (`webview/js/trace-viewer.js`) provides:

- Basic span timeline with start/duration visualization
- Simple color coding by span type (HTTP, DB, resolve, etc.)
- Basic tooltips with timing and limited attributes
- Flat list view of spans

## Enhancement Goals

1. **Look more professional** - Modern UI with visual depth and hierarchy
2. **Better functionality** - Rich details, navigation, and analysis features
3. **VS Code integration** - Leverage the editor context for unique capabilities
4. **GraphQL-specific features** - Tailored for StepZen's federation scenarios

## Planned Features

### 1. Visual Hierarchy & Modern UI

- **Nested span display** with proper indentation showing parent-child relationships
- **Collapsible span groups** - click to expand/collapse children spans
- **Modern timeline design** with visual depth (shadows, gradients, better typography)
- **Span dependency lines** connecting parent spans to their children
- **Minimap overview** at the top showing the compressed full trace
- **Zoom/pan controls** for navigating long traces
- **Responsive design** that adapts to panel width

### 2. Rich Span Details Panel

When clicking a span, display a detailed side panel containing:

- **Full attributes** (complete OTEL attribute set, not just tooltip subset)
- **Span events/logs** if present in the OpenTelemetry data
- **Resource information** from the OTEL resource spans
- **Performance metrics** including self-time vs total time calculations
- **Error details** with full stack traces if the span failed
- **Timing breakdown** showing time spent in this span vs children

### 3. VS Code Integration Features ⭐ (Unique Value)

- **"Go to Schema" button** - navigate from a span to the GraphQL schema definition
- **"Go to Resolver" link** - jump to the field resolver in the schema if the span represents field resolution
- **"View Query" action** - highlight the part of the GraphQL query this span represents
- **Code lens integration** - show trace timing information directly in GraphQL files
- **Diagnostic correlation** - link spans to VS Code diagnostic messages
- **File navigation** - open relevant schema files from trace context

### 4. Smart Filtering & Search

- **Filter by span type** (HTTP, database, resolver, materialization, etc.)
- **Search span names and attributes** with real-time filtering
- **Error-only view** - show/hide spans based on error status
- **Critical path highlighting** - identify and highlight the longest dependency chain
- **Duration thresholds** - filter spans above/below certain timing thresholds
- **Service filtering** - show spans from specific backend services only

### 5. Performance Analysis

- **Flame graph view** as an alternative visualization to the timeline
- **Service dependency map** showing which external services were called
- **Bottleneck identification** - automatically highlight the slowest spans
- **Parallel vs sequential execution** visualization
- **Waterfall analysis** - show request dependencies and blocking relationships
- **Performance recommendations** based on span patterns

### 6. GraphQL-Specific Features

- **Field resolution tree** that matches the GraphQL query structure
- **Materializer performance breakdown** showing data source efficiency
- **Data source attribution** - clearly show which spans hit which backends
- **Query complexity correlation** with execution timing
- **Schema coverage** - show which parts of the schema were exercised
- **Federation insights** - highlight cross-service calls and their costs

## Implementation Approach

### Phase 1: Visual Hierarchy + Details Panel

**Goal**: Make it look professional and show comprehensive span information

**Tasks**:

- Implement nested span display with proper indentation
- Add collapsible span groups (expand/collapse children)
- Create a details panel that appears when clicking spans
- Modernize the CSS with better typography, spacing, and visual hierarchy
- Add span dependency lines connecting parents to children
- Improve the timeline visualization with better colors and styling

**Deliverables**:

- Enhanced `trace-viewer.js` with hierarchical rendering
- New CSS for modern styling and layout
- Interactive details panel component
- Improved span selection and highlighting

### Phase 2: VS Code Navigation Integration

**Goal**: Leverage VS Code context for unique developer experience

**Tasks**:

- Add message passing between webview and extension
- Implement "Go to Schema" functionality
- Create span-to-code navigation features
- Add code lens integration for timing display
- Implement diagnostic correlation

**Deliverables**:

- Webview-to-extension communication protocol
- Schema navigation commands
- Code lens enhancements
- Diagnostic integration

### Phase 3: Advanced Analysis Features

**Goal**: Provide professional-grade trace analysis capabilities

**Tasks**:

- Implement filtering and search functionality
- Add performance analysis features (bottleneck detection, critical path)
- Create alternative visualizations (flame graph, service map)
- Add GraphQL-specific analysis features
- Implement zoom/pan and minimap for large traces

**Deliverables**:

- Advanced filtering UI
- Performance analysis algorithms
- Alternative visualization modes
- GraphQL-aware analysis features

## Technical Considerations

### Architecture

- Maintain the current React-based approach for consistency
- Use CSS custom properties for theming to match VS Code
- Implement efficient rendering for large traces (virtualization if needed)
- Design for extensibility to add new span types and analysis features

### Performance

- Lazy loading for large trace datasets
- Efficient DOM updates when filtering/searching
- Debounced search and filter operations
- Memory-conscious span data processing

### Accessibility

- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management for interactive elements

### Integration Points

- Extension message passing API
- Schema index service integration
- Diagnostic service correlation
- File navigation service usage

## Success Metrics

- **Visual Appeal**: Modern, professional appearance matching VS Code design language
- **Functionality**: Comprehensive span analysis capabilities
- **Developer Experience**: Seamless navigation between trace and code
- **Performance**: Smooth interaction with traces containing 100+ spans
- **Adoption**: Positive developer feedback and increased usage

---

_Portions of the Content may be generated with the assistance of CursorAI_
