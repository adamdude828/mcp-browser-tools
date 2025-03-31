# Browser Connect Extension Improvement Tasks

## Extension Improvements

### 1. Modularize window.js
- [x] **Description**: The window.js file (638 lines) is too large and handles multiple responsibilities.
- [x] **Task**: Refactor window.js into smaller modules:
  - [x] Socket connection management module
  - [x] Tab management module 
  - [x] UI update module
  - [x] Element selection module
  - [x] Update project-context.mdc with module structure and relationships
- [x] **Benefit**: Improved maintainability and separation of concerns

### 2. Modularize content-script.js
- [x] **Description**: The content-script.js file (701 lines) contains many different responsibilities.
- [x] **Task**: Refactor into smaller modules:
  - [x] Element highlighting module
  - [x] Element selection module
  - [x] UI/Modal module
  - [x] DOM interaction utilities
  - [x] Update project-context.mdc with content-script module structure
- [x] **Benefit**: Better organization and easier to maintain

### 3. Modularize popup.js
- [x] **Description**: The popup.js file (612 lines) is handling too many responsibilities.
- [x] **Task**: Split into smaller modules:
  - [x] Connection management module
  - [x] Element display module
  - [x] Selection management module 
  - [x] UI utilities
  - [x] Update project-context.mdc with popup module structure
- [x] **Benefit**: More maintainable code with clear separation of concerns

### 4. Create Shared Utilities
- [ ] **Description**: There's duplicated code across popup.js, window.js, and content-script.js.
- [ ] **Task**: Extract common utilities to shared modules:
  - [ ] Connection management
  - [ ] Logging utilities
  - [ ] UI helpers
  - [ ] Element selection logic
  - [ ] Update project-context.mdc with shared utilities documentation
- [ ] **Benefit**: Reduced code duplication and easier maintenance

### 5. Implement TypeScript
- [ ] **Description**: The extension is written in plain JavaScript without types.
- [ ] **Task**: Convert extension code to TypeScript for better type safety
  - [ ] Add tsconfig.json for the extension
  - [ ] Convert JS files to TS one at a time
  - [ ] Add appropriate type definitions
  - [ ] Update project-context.mdc with TypeScript conventions
- [ ] **Benefit**: Type safety, better IDE support, easier refactoring

## HTTP Server Improvements

### 6. Enhance Tab Management
- [ ] **Description**: The tab management in the HTTP server is limited.
- [ ] **Task**: Improve the tab manager service:
  - [ ] Add more robust error handling
  - [ ] Create proper interfaces for tab data
  - [ ] Add support for multiple browser windows
  - [ ] Update project-context.mdc with tab management architecture
- [ ] **Benefit**: More reliable tab handling and better error reporting

### 7. Expand MCP Tools Structure
- [ ] **Description**: The tools directory has minimal structure for future expansion.
- [ ] **Task**: Reorganize the tools directory:
  - [ ] Group related tools into subdirectories
  - [ ] Create a more robust tool registration pattern
  - [ ] Add documentation for each tool
  - [ ] Update project-context.mdc with tools organization guide
- [ ] **Benefit**: Better scalability for adding new browser tools

## Testing and Documentation

### 8. Add Unit Tests
- [ ] **Description**: The codebase lacks formal testing.
- [ ] **Task**: Add unit tests for:
  - [ ] Tab management functionality
  - [ ] Socket connection handling
  - [ ] MCP tool implementations
  - [ ] Update project-context.mdc with testing approach and examples
- [ ] **Benefit**: Better code quality and easier to catch regressions

### 9. Improve Code Documentation
- [ ] **Description**: Some code lacks sufficient documentation.
- [ ] **Task**: Add better JSDoc/TSDoc comments to:
  - [ ] All public functions and methods
  - [ ] Complex algorithms and logic
  - [ ] Socket event handlers
  - [ ] Update project-context.mdc with documentation standards
- [ ] **Benefit**: Easier onboarding for new developers and better maintainability

### 10. Create Developer Documentation
- [ ] **Description**: Missing comprehensive documentation for extending the system.
- [ ] **Task**: Create documentation for:
  - [ ] Adding new MCP tools
  - [ ] Extension architecture
  - [ ] Communication protocol between components
  - [ ] Update and finalize project-context.mdc as main reference
- [ ] **Benefit**: Easier for new developers to understand and contribute to the project 