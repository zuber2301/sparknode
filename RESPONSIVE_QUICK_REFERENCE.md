# Responsive Design Quick Reference Card

## Quick Start

```jsx
// Mobile-first responsive pattern
<div className="p-3 sm:p-4 lg:p-6">
  Mobile: 12px padding
  Tablet: 16px padding
  Desktop: 24px padding
</div>
```

## Tailwind Breakpoints
```
Base    →  sm    →  md    →  lg     →  xl     →  2xl
0-639px   640px   768px   1024px   1280px   1536px
mobile    tablet  tablet  desktop  large    extra
```

## Common Responsive Classes

### Padding & Spacing
```jsx
p-3 sm:p-4 lg:p-6              // Padding: 12px → 16px → 24px
px-3 sm:px-4 lg:px-8           // Horizontal padding
py-2 sm:py-2.5 lg:py-3         // Vertical padding
gap-2 sm:gap-3 lg:gap-4        // Gap between flex/grid items
space-y-3 sm:space-y-4 lg:space-y-6  // Vertical spacing
```

### Typography
```jsx
text-sm sm:text-base lg:text-lg         // Text size scaling
text-lg sm:text-xl lg:text-2xl          // Heading scaling
text-2xl sm:text-3xl lg:text-4xl        // Large heading
font-medium text-gray-900               // Apply to all breakpoints
```

### Icons
```jsx
w-5 h-5 sm:w-6 sm:h-6                  // 20px → 24px
w-4 h-4 sm:w-5 sm:h-5                  // 16px → 20px
w-10 h-10 sm:w-12 sm:h-12              // 40px → 48px
```

### Grid & Flex Layouts
```jsx
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3    // 1 → 2 → 3 columns
flex flex-col sm:flex-row                          // Stack → Row
items-start sm:items-center                        // Vertical alignment
justify-between gap-3 sm:gap-4                     // Spacing between
```

### Width & Max-Width
```jsx
w-full                                  // Full width (100%)
w-full max-w-2xl                        // Full with cap
w-full max-w-sm sm:max-w-md lg:max-w-lg // Responsive max-width
w-64 md:w-72 lg:w-80                    // Responsive fixed width (rare)
```

### Visibility
```jsx
block sm:hidden               // Show on mobile, hide on sm+
hidden sm:block              // Hide on mobile, show on sm+
hidden md:block              // Hide on mobile/tablet, show on desktop
hidden lg:block              // Hide on mobile/tablet
```

### Border Radius
```jsx
rounded-lg sm:rounded-xl      // 8px → 12px
rounded-lg sm:rounded-xl lg:rounded-2xl  // 8px → 12px → 16px
```

## Component Patterns

### Stat Card
```jsx
<div className="card">
  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
    <div className="flex-1">
      <p className="text-xs sm:text-sm text-gray-500">Label</p>
      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
        {value}
      </p>
    </div>
    <Icon className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
  </div>
</div>
```

### List Item
```jsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4">
  <div className="flex-1 min-w-0">
    <p className="font-medium truncate">Title</p>
    <p className="text-xs sm:text-sm text-gray-500">Description</p>
  </div>
  <button className="flex-shrink-0">Action</button>
</div>
```

### Header with Action
```jsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
  <div>
    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Title</h1>
    <p className="text-xs sm:text-sm text-gray-500 mt-1">Subtitle</p>
  </div>
  <button className="btn-primary w-full sm:w-auto">Action</button>
</div>
```

### Responsive Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Form Group
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <div>
    <label className="label">Field 1</label>
    <input className="input text-sm sm:text-base" />
  </div>
  <div>
    <label className="label">Field 2</label>
    <input className="input text-sm sm:text-base" />
  </div>
</div>
```

## Pro Tips

### 1. Prevent Text Overflow
```jsx
// Use min-w-0 on flex parent
<div className="flex gap-2 min-w-0">
  <p className="truncate">Long text</p>
</div>
```

### 2. Mobile-First Button
```jsx
// Full width on mobile, auto on tablet+
<button className="w-full sm:w-auto btn-primary">Action</button>
```

### 3. Responsive Container
```jsx
// Responsive padding with max-width
<div className="w-full max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
  Content
</div>
```

### 4. Flex Shrink Icons
```jsx
// Prevent icon from shrinking in flex
<div className="flex gap-2">
  <Icon className="flex-shrink-0" />
  <p>Text</p>
</div>
```

### 5. Responsive Modal
```jsx
<div className="fixed inset-0 p-4 sm:p-6 z-50">
  <div className="bg-white max-w-sm sm:max-w-md lg:max-w-lg m-auto">
    Content
  </div>
</div>
```

## Utility Classes Cheat Sheet

| Purpose | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Padding | p-3 | sm:p-4 | lg:p-6 |
| Horizontal Padding | px-3 | sm:px-4 | lg:px-8 |
| Gap | gap-2 | sm:gap-3 | lg:gap-4 |
| Heading | text-2xl | sm:text-3xl | lg:text-4xl |
| Body Text | text-sm | sm:text-base | lg:text-lg |
| Icon | w-5 h-5 | sm:w-6 sm:h-6 | lg:w-7 lg:h-7 |
| Grid Cols | grid-cols-1 | sm:grid-cols-2 | lg:grid-cols-3 |
| Border Radius | rounded-lg | sm:rounded-xl | lg:rounded-2xl |

## Common Mistakes ❌ → Fixes ✅

| Problem | Wrong ❌ | Right ✅ |
|---------|---------|----------|
| Fixed width | `w-96` | `w-full max-w-96` |
| Desktop-first | `p-8 md:p-6 sm:p-4` | `p-3 sm:p-4 lg:p-6` |
| Text overflow | `<p className="truncate">` | `<div className="flex min-w-0"><p className="truncate">` |
| Icon same size | `w-6 h-6` | `w-5 h-5 sm:w-6 sm:h-6` |
| No spacing | `<div>Content</div>` | `<div className="p-3 sm:p-4">` |
| Horizontal scroll | No `overflow-x-hidden` | Add to main container |

## Testing Checklist

- [ ] Test at 375px width (mobile)
- [ ] Test at 640px width (tablet)
- [ ] Test at 1024px width (desktop)
- [ ] No horizontal scroll at any size
- [ ] Touch targets 40px+ tall
- [ ] Text is readable at all sizes
- [ ] Images scale properly
- [ ] Buttons don't overflow
- [ ] Forms are full-width on mobile
- [ ] Cards stack vertically on mobile

## Available Utilities

Import in your CSS:
```css
@import './styles/responsive.css';
```

Then use classes like:
```jsx
className="text-fluid-h1"       // Fluid heading
className="p-fluid"             // Responsive padding
className="grid-responsive"     // Responsive grid
className="card-responsive"     // Responsive card
className="input-responsive"    // Responsive input
className="modal-responsive"    // Responsive modal
```

## Resources

- **Full Guide**: See `RESPONSIVE_UI_GUIDE.md`
- **Components**: See `RESPONSIVE_COMPONENTS.md`
- **Utilities**: See `frontend/src/styles/responsive.css`
- **Live Examples**: Check updated components in `frontend/src/pages/`

## Remember

> **Always think mobile first**
> 
> Write for mobile (320px) first, then enhance with sm:, md:, lg: prefixes for larger screens. This ensures great experience for everyone and prevents layout issues.

---

**Last Updated**: [Current Session] | **Version**: 1.0
