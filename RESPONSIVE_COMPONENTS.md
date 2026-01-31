# Responsive Components Implementation Guide

## Quick Reference for Each Component Type

### 1. Forms & Inputs

**Responsive Form Container**
```jsx
<form className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
  {/* form fields */}
</form>
```

**Responsive Input Group**
```jsx
<div className="space-y-2">
  <label className="label">Field Label</label>
  <input className="input text-sm sm:text-base" placeholder="Enter text" />
  <p className="text-xs sm:text-sm text-gray-500">Helper text</p>
</div>
```

**Responsive Form Grid**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  {/* form fields */}
</div>
```

### 2. Tables & Lists

**Responsive Table Wrapper**
```jsx
<div className="overflow-x-auto -mx-3 sm:-mx-4 md:mx-0 rounded-lg border border-gray-200">
  <table className="min-w-full">
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50">
        <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-medium text-gray-700">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      {/* rows */}
    </tbody>
  </table>
</div>
```

**Responsive List Item**
```jsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border-b border-gray-200 hover:bg-gray-50">
  <div className="flex-1 min-w-0">
    <p className="text-sm sm:text-base font-medium text-gray-900 truncate">Title</p>
    <p className="text-xs sm:text-sm text-gray-500">Description</p>
  </div>
  <div className="flex gap-2 flex-shrink-0">
    {/* actions */}
  </div>
</div>
```

### 3. Modals & Dialogs

**Responsive Modal**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50">
  <div className="bg-white rounded-lg sm:rounded-xl w-full max-w-sm sm:max-w-md lg:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
    <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Title</h2>
    {/* content */}
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
      <button className="btn-secondary flex-1">Cancel</button>
      <button className="btn-primary flex-1">Confirm</button>
    </div>
  </div>
</div>
```

### 4. Navigation & Menus

**Responsive Navigation Bar**
```jsx
<nav className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-8 py-4">
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-2 sm:gap-4">
      {/* logo or title */}
    </div>
    <div className="flex items-center gap-2 sm:gap-3">
      {/* nav items */}
    </div>
  </div>
</nav>
```

**Responsive Dropdown Menu**
```jsx
<div className="relative">
  <button className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-gray-100">
    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
    <span className="hidden sm:inline text-sm">Label</span>
  </button>
  {isOpen && (
    <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      {/* menu items */}
    </div>
  )}
</div>
```

### 5. Cards & Containers

**Responsive Stat Card**
```jsx
<div className="card">
  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
    <div className="flex-1">
      <p className="text-xs sm:text-sm text-gray-500">Label</p>
      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-1">
        {value}
      </p>
    </div>
    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
    </div>
  </div>
</div>
```

**Responsive Hero Section**
```jsx
<div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg sm:rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 text-white">
  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Title</h1>
  <p className="text-xs sm:text-sm lg:text-base text-white/80">Description</p>
</div>
```

### 6. Grids & Layouts

**Responsive Product/Card Grid**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
  {items.map(item => (
    <div key={item.id} className="card">
      {/* card content */}
    </div>
  ))}
</div>
```

**Responsive Two-Column Layout**
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
  <div className="lg:col-span-2">
    {/* main content */}
  </div>
  <div>
    {/* sidebar */}
  </div>
</div>
```

### 7. Buttons & Actions

**Responsive Button Group**
```jsx
<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
  <button className="btn-secondary flex-1 sm:flex-auto">Secondary</button>
  <button className="btn-primary flex-1 sm:flex-auto">Primary</button>
</div>
```

**Responsive Icon Button**
```jsx
<button className="p-2 sm:p-2.5 lg:p-3 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
</button>
```

### 8. Search & Filters

**Responsive Search Bar**
```jsx
<div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
  <input 
    className="input flex-1 text-sm sm:text-base"
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
  <button className="btn-secondary flex-1 sm:flex-auto whitespace-nowrap">
    <Icon className="w-4 h-4" />
    Filter
  </button>
</div>
```

**Responsive Filter Bar**
```jsx
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
  <select className="input text-sm sm:text-base flex-1">
    <option>All</option>
  </select>
  <select className="input text-sm sm:text-base flex-1 sm:flex-auto">
    <option>All</option>
  </select>
</div>
```

## Common Responsive Patterns

### Pattern: Status Badge + Text
```jsx
<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
  <span className="badge badge-success">Active</span>
  <p className="text-xs sm:text-sm text-gray-600">Last updated 2 hours ago</p>
</div>
```

### Pattern: Icon + Title + Action
```jsx
<div className="flex items-start sm:items-center gap-3 sm:gap-4">
  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
  <div className="flex-1 min-w-0">
    <p className="font-medium text-gray-900">Title</p>
    <p className="text-xs sm:text-sm text-gray-500">Description</p>
  </div>
  <button className="flex-shrink-0">Action</button>
</div>
```

### Pattern: Two-Line Header with Action
```jsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
  <div>
    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Title</h1>
    <p className="text-xs sm:text-sm text-gray-500 mt-1">Subtitle</p>
  </div>
  <button className="btn-primary w-full sm:w-auto whitespace-nowrap">Action</button>
</div>
```

## Mobile-First Checklist

- [ ] Base styling works on 320px width
- [ ] Add `sm:` prefixes for 640px+ improvements
- [ ] Add `md:` prefixes for 768px+ improvements
- [ ] Add `lg:` prefixes for 1024px+ improvements
- [ ] Test text sizes are readable at each breakpoint
- [ ] Test touch targets are at least 40-44px
- [ ] Test no horizontal scroll at any width
- [ ] Test flex/grid items don't overflow
- [ ] Test images scale properly with `max-w-full`
- [ ] Test modals fit screen on mobile with padding
- [ ] Test tables have horizontal scroll if needed
- [ ] Test navigation is accessible on mobile
- [ ] Test form fields are full width on mobile
- [ ] Test buttons are full width on mobile when appropriate
- [ ] Test spacing is appropriate at each breakpoint

## Testing with Browser DevTools

1. Open your page
2. Press F12 to open DevTools
3. Click device toolbar icon or Ctrl+Shift+M
4. Test at these viewport sizes:
   - **320px**: iPhone SE
   - **375px**: iPhone 12/13
   - **425px**: Pixel 5
   - **640px**: Landscape phone
   - **768px**: Tablet portrait (iPad)
   - **1024px**: Tablet landscape / Desktop
   - **1280px**: Large desktop
   - **1920px**: Full HD desktop

## Common Mistakes to Avoid

### ❌ Fixed widths
```jsx
<div className="w-96">  // Breaks on mobile
```

### ✅ Responsive widths
```jsx
<div className="w-full max-w-md sm:max-w-lg">
```

### ❌ Desktop-first
```jsx
<div className="p-8 md:p-6 sm:p-4">  // Wrong order
```

### ✅ Mobile-first
```jsx
<div className="p-3 sm:p-4 md:p-6 lg:p-8">  // Correct order
```

### ❌ Overflow text
```jsx
<div className="flex">
  <p className="truncate">Very long text</p>
</div>
```

### ✅ Proper text handling
```jsx
<div className="flex min-w-0">
  <p className="truncate">Very long text</p>
</div>
```

### ❌ Unscaled icons
```jsx
<Icon className="w-6 h-6" />  // Same size everywhere
```

### ✅ Responsive icons
```jsx
<Icon className="w-5 h-5 sm:w-6 sm:h-6" />  // Scales up
```
