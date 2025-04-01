# React Element Selection Baseline Issues

This document tracks the baseline issues observed with element selection in React applications during Phase 1 testing.

## Test Environment

- **React Version**: Latest (using React 19+)
- **Browser**: Chrome/Firefox latest
- **React Mode**: Development mode with frequent rerenders
- **Test Components**:
  - Dynamic list with item addition/removal
  - Card with expandable content
  - Regularly updating counter component

## Known Issues to Test

1. **React DOM Reconciliation Issues**
   - [ ] Element references becoming stale after React rerenders
   - [ ] Highlight positions not updating when elements move
   - [ ] Selected element being replaced by React with a new instance

2. **CSS Interference Issues**
   - [ ] Extension styles conflicting with React app styles
   - [ ] Z-index conflicts with React components
   - [ ] Style inheritance affecting highlight appearance

3. **Element Reference Stability**
   - [ ] Direct DOM references lost during React updates
   - [ ] Issues with dynamically added/removed elements
   - [ ] Difficulties identifying the same element across renders

4. **Event System Conflicts**
   - [ ] React synthetic events capturing clicks before extension
   - [ ] Event propagation preventing element selection
   - [ ] Issues with React event delegation

5. **DOM Isolation Issues**
   - [ ] Extension UI affected by React styles
   - [ ] Extension elements accidentally captured by React events
   - [ ] Unintended interactions between extension and React app

## Test Results

| Issue | Status | Notes | Frequency |
|-------|--------|-------|-----------|
|       |        |       |           |

## Specific Test Steps

1. Select a static element (heading/paragraph) and observe behavior
2. Select a list item, then add/remove items from the list
3. Select a button that toggles content visibility
4. Select dynamically appearing content
5. Select an element, then wait for counter update (React rerender)
6. Try selecting elements inside the Card when expanded/collapsed

## Conclusions

(To be filled after testing)

## Next Steps

(Recommendations based on testing) 