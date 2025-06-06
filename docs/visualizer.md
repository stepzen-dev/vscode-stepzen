<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# StepZen Schema Visualizer

The StepZen Schema Visualizer provides an interactive, force-directed graph visualization of GraphQL schemas, helping developers understand type relationships and schema structure.

## Current Features

### Core Visualization

- **Force-directed layout**: Uses D3.js physics simulation for natural node positioning
- **Dual attachment points**: Smart connection routing with left/right attachment optimization
- **Type boxes**: Professional-styled boxes with headers and field sections
- **Field-to-type connections**: Curved lines connecting specific fields to their referenced types
- **Scalar type filtering**: Excludes scalar types to reduce visual clutter

### Interactive Features

- **Click navigation**: Navigate to type/field definitions in source code
- **Drag and drop**: Manual repositioning without simulation interference
- **Zoom and pan**: Full viewport control with mouse wheel and drag
- **Search functionality**: Find types and fields with highlighting and navigation
- **Auto-fit**: Automatic layout with generous padding on initial load

### Visual Design

- **Theme awareness**: Adapts to VS Code light/dark themes
- **Color-coded types**: Different colors for scalar, list, and object types
- **Root type highlighting**: Special styling for Query/Mutation/Subscription
- **Hover effects**: Interactive feedback on field boxes
- **Connection labels**: Field names displayed along connection paths

## Architecture

### Technology Stack

- **D3.js v7**: Force simulation and SVG rendering
- **VS Code Webview API**: Integration with editor
- **TypeScript**: Type safety and IntelliSense support

### Code Organization

```
webview/js/schema-visualizer.js  # Main visualization logic
├── Constants                   # Visual and layout parameters
├── Data Processing            # Schema model transformation
├── Force Simulation           # D3.js physics setup
├── Connection System          # Dual attachment point logic
├── Interaction Handlers       # Drag, zoom, search, navigation
└── Utility Functions          # Position calculations, auto-fit
```

### Key Components

1. **Schema Model**: Processed from StepZen schema index
2. **Node System**: Type boxes with headers and field sections
3. **Connection System**: Smart routing between fields and types
4. **Layout Engine**: D3.js force simulation with collision detection
5. **Interaction Layer**: Mouse/keyboard event handling

## Performance Considerations

### Current Optimizations

- Scalar type filtering reduces node count
- Simulation stops after initial layout
- Efficient SVG rendering with proper z-ordering

### Known Performance Issues

- Connection path calculations run on every tick
- Label positioning recalculates bezier math redundantly
- No caching of computed positions when nodes are static

## Future Enhancements

### High Priority Performance Optimizations

- [ ] **Connection caching**: Cache path calculations when nodes aren't moving
- [ ] **Shared computation**: Combine path and label calculations
- [ ] **Debounced search**: Improve search input responsiveness
- [ ] **Lazy rendering**: Virtualize large schemas
- [ ] **Web Workers**: Offload heavy calculations

### High Priority Code Organization

- [ ] **Modular architecture**: Split into focused modules
- [ ] **Configuration system**: Centralized settings management
- [ ] **Error boundaries**: Graceful degradation strategies
- [ ] **Unit testing**: Test coverage for core functions
- [ ] **Documentation**: JSDoc comments and API docs

### Visual Improvements

- [ ] **Smart routing**: Pathfinding algorithm to avoid crossing type boxes
- [ ] **Connection bundling**: Group multiple connections between same types
- [ ] **Minimap**: Overview navigation for large schemas
- [ ] **Type grouping**: Cluster related types by domain/namespace
- [ ] **Collapsible sections**: Hide/show fields to reduce complexity
- [ ] **Connection filtering**: Show only selected type relationships
- [ ] **Animation system**: Smooth transitions for layout changes

### Interaction Features

- [ ] **Multi-select**: Bulk operations on multiple types
- [ ] **Connection highlighting**: Highlight paths on hover
- [ ] **Breadcrumb navigation**: Track focused view history
- [ ] **Keyboard shortcuts**: Common actions (zoom, search, navigate)
- [ ] **Context menus**: Right-click operations
- [ ] **Touch support**: Mobile/tablet interaction
- [ ] **Accessibility**: Screen reader and keyboard navigation

### Schema Analysis

- [ ] **Dependency analysis**: Show all types that depend on selected type
- [ ] **Circular dependency detection**: Highlight problematic relationships
- [ ] **Schema metrics**: Complexity, depth, and usage statistics
- [ ] **Unused type detection**: Identify orphaned types
- [ ] **Schema diff**: Compare different schema versions
- [ ] **Performance impact**: Analyze query complexity implications
- [ ] **Validation warnings**: Overlay schema issues

### Export and Integration

- [ ] **Export formats**: SVG, PNG, PDF generation
- [ ] **Documentation generation**: Auto-generate docs from visualization
- [ ] **GraphQL Playground**: Integration with query testing
- [ ] **Schema validation**: Real-time error highlighting
- [ ] **Version control**: Track schema evolution over time
- [ ] **Sharing**: Shareable links for specific views

### Layout Options

- [ ] **Multiple algorithms**: Hierarchical, circular, tree layouts
- [ ] **Layout persistence**: Save/load custom arrangements
- [ ] **Layout suggestions**: AI-powered optimal arrangements
- [ ] **Responsive design**: Adapt to different screen sizes
- [ ] **Print optimization**: Layout suitable for documentation

### Advanced Features

- [ ] **Schema comparison**: Side-by-side diff visualization
- [ ] **Query path tracing**: Visualize resolver execution paths
- [ ] **Federation support**: Multi-service schema visualization
- [ ] **Real-time updates**: Live schema change detection
- [ ] **Collaborative features**: Shared viewing sessions
- [ ] **Plugin system**: Extensible visualization components

## Development Guidelines

### Adding New Features

1. Follow the existing modular pattern
2. Add constants for magic numbers
3. Include defensive null checks
4. Update this documentation
5. Consider performance implications

### Testing Strategy

- Unit tests for utility functions
- Integration tests for D3.js interactions
- Visual regression tests for layout consistency
- Performance benchmarks for large schemas

### Code Quality

- TypeScript strict mode enabled
- ESLint configuration enforced
- Consistent error handling patterns
- Comprehensive logging for debugging

---

_Portions of the Content may be generated with the assistance of CursorAI_
