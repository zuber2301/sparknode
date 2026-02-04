# SNPilot Manager - Morning Briefing Implementation

## Overview

The **Morning Briefing** component has been successfully implemented for tenant managers. It's the first screen they see when opening the dashboard or TeamHub, providing a personalized daily overview.

---

## Features Implemented

### 1. **Master Pool Budget Display** 💰
- Shows total budget allocated to the tenant
- Prominently displayed for quick reference
- Value: `₹85,000` (as per your example)

### 2. **Team Lead Budget Status** 📊
- Automatically fetches all direct report leads
- Shows budget usage percentage for each lead
- **Top-up Alerts**: Highlights leads with 80%+ budget usage
- Displays remaining budget balance for each lead
- Example: "Sita has used 85% of her budget—she might need a top-up soon"

### 3. **Recognition Statistics** 📈
- Week-over-week comparison
- Shows total recognitions given this week
- Calculates percentage change vs. last week
- Example: "Recognition is up 12% this week compared to last!"

### 4. **Quick Action Tips** 💡
- Contextual advice for managers
- Suggests when to distribute budget to keep momentum

---

## Component Structure

**File**: `frontend/src/components/MorningBriefing.jsx`

```jsx
MorningBriefing Component
├── Tenant Master Pool Data
│   └── Budget allocation balance
├── Team Leads Status
│   ├── Direct reports fetch
│   ├── Budget usage calculation
│   └── Top-up alerts (85%+)
├── Recognition Stats
│   ├── This week count
│   ├── Last week comparison
│   └── Percentage change
└── Quick Tips
    └── Contextual manager advice
```

### Data Sources

The component fetches data from:
- **Tenant API**: Master pool budget
- **Users API**: Direct reports (team leads)
- **Recognition API**: Stats and trends

---

## Integration Points

### 1. **Dashboard (`pages/Dashboard.jsx`)**
- Shows for managers (`tenant_manager`, `tenant_lead` roles)
- Displays above stats grid
- Hides regular welcome card for managers

### 2. **TeamHub (`pages/TeamHub.jsx`)**
- Shows as first item in team hub
- Precedes direct reports listing
- Provides context before detailed team view

---

## Visual Layout

```
┌─────────────────────────────────────────────────────┐
│ 🌅 Morning Briefing Card (Blue gradient)           │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Good morning, [Manager Name]! 👋                   │
│ Here's your snapshot for today:                    │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Master Pool                                  │   │
│ │ ₹85,000                           💳         │   │
│ │ Available for distribution to your team     │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ Team Lead Status:                                  │
│ ┌──────────────────────────────────────────────┐   │
│ │ ⚠️  Sita                                      │   │
│ │    85% used — Top-up recommended             │   │
│ │                              ₹2,500 remaining│   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ Raj                                          │   │
│ │ 45% used                                     │   │
│ │                             ₹15,000 remaining│   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ Recognition This Week                        │   │
│ │ 24 recognitions                    +12% 📈   │   │
│ │ vs. last week — Great engagement!            │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 💡 Quick Tip                                        │
│ Consider distributing budget to leads with high    │
│ usage to keep the momentum going!                  │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Manager opens Dashboard/TeamHub
        ↓
MorningBriefing Component loads
        ↓
        ├─→ tenantsAPI.getById() → Fetch tenant data
        │                          (budget_allocation_balance)
        │
        ├─→ usersAPI.getDirectReports() → Fetch team leads
        │                                  (with wallet data)
        │
        └─→ recognitionAPI.getTenantStats() → Fetch recognition
                                              (week-over-week)
        ↓
Process data:
  ├─ Calculate budget usage % for each lead
  ├─ Identify leads needing top-up (≥80%)
  ├─ Calculate recognition change
  └─ Sort leads by budget usage (descending)
        ↓
Render:
  ├─ Master Pool display
  ├─ Top 3 Team Lead alerts
  ├─ Recognition stats
  └─ Quick tips
```

---

## Responsive Design

The component is **fully responsive**:

### Mobile (< 640px)
- Stacked layout
- Smaller fonts and spacing
- Touch-friendly sizing
- Single column for alerts

### Tablet (640px - 1024px)
- Medium padding and fonts
- Optimized spacing
- Balanced two-column support

### Desktop (> 1024px)
- Full layout with icon placement
- Generous spacing and typography
- Sparkle icon visible on right
- Multi-column support

---

## Example Data

Based on your scenario:

```javascript
{
  masterPoolBudget: 85000,
  teamLeads: [
    {
      name: "Sita",
      budgetUsagePercent: 85,
      balance: 2500,
      earned: 17500,
      needsTopUp: true  // 85% >= 80%
    },
    {
      name: "Raj",
      budgetUsagePercent: 45,
      balance: 15000,
      earned: 12000,
      needsTopUp: false
    }
  ],
  recognitionStats: {
    thisWeek: 24,
    lastWeek: 21.43,  // 24 / (24/21.43) = approx 12% increase
    percentageChange: 12
  }
}
```

---

## Messages Generated

### For Sita (85% usage):
✅ "Sita has used 85% of her budget—she might need a top-up soon"

### Recognition Update:
✅ "Recognition is up 12% this week compared to last!"

### Master Pool:
✅ "Good morning! You have ₹85,000 in your Master Pool"

---

## Styling

- **Colors**: Blue/indigo theme (matching Sparknode brand)
- **Icons**: Heroicons (currency, alert, trending up, lightbulb)
- **Gradients**: Subtle blue-to-indigo gradient background
- **Shadows**: Soft shadows for depth
- **Borders**: Subtle border for definition

---

## Future Enhancements

Potential additions:
1. **Refresh button** to manually update morning briefing
2. **Direct action**: "Top-up Sita" button → distribution modal
3. **Announcement banner** for important updates
4. **Customizable insights** - managers can choose which metrics to see
5. **Comparison charts** - visual representation of team performance

---

## Technical Details

### Dependencies
- `@tanstack/react-query` - Data fetching and caching
- `react-icons/hi` - Heroicons
- `react-router-dom` - Navigation (via useAuthStore)

### API Endpoints Used
- `GET /api/tenants/{id}` - Tenant budget data
- `GET /api/users/{id}/direct-reports` - Team leads
- `GET /api/recognition/tenant/{tenant_id}/stats` - Recognition stats

### Auth Integration
- Uses `useAuthStore` from Zustand
- Role-based visibility (`tenant_manager`, `tenant_lead`)
- Filters direct reports automatically

---

## Files Modified/Created

### Created:
✅ `frontend/src/components/MorningBriefing.jsx` (279 lines)

### Updated:
✅ `frontend/src/pages/Dashboard.jsx` - Imported and integrated
✅ `frontend/src/pages/TeamHub.jsx` - Imported and integrated

---

## Testing Checklist

- [ ] Verify component renders on manager dashboard
- [ ] Check budget values display correctly
- [ ] Confirm team lead alerts appear for ≥80% usage
- [ ] Validate recognition stats calculation
- [ ] Test responsive layout on mobile/tablet/desktop
- [ ] Verify data refreshes on navigation
- [ ] Check icon rendering and styling
- [ ] Test with multiple team leads
- [ ] Verify with zero recognition stats
- [ ] Check with high/low master pool values

---

## Summary

The **Morning Briefing** provides managers with an at-a-glance overview of:
- 💰 **Financial**: Master pool and team lead budget status
- 📊 **Team Health**: Recognition trends and momentum
- 🎯 **Actionable Insights**: Top-up recommendations and quick tips

This first-screen feature helps managers make informed decisions about budget distribution and team recognition strategy without needing to navigate multiple pages.
