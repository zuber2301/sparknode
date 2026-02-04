# Morning Briefing - Quick Reference

## What It Is
A personalized greeting card that appears as the **first thing managers see** on their Dashboard or TeamHub.

## Where It Appears
1. **Dashboard** (`/dashboard`) - For tenant managers
2. **TeamHub** (`/team-hub`) - Above direct reports listing

## What It Shows

### 1️⃣ Master Pool Budget
```
Master Pool: ₹85,000
(Available for distribution to your team)
```

### 2️⃣ Team Lead Budget Alerts
```
⚠️ Sita - 85% used | ₹2,500 remaining
   (Top-up recommended)

Raj - 45% used | ₹15,000 remaining
```

### 3️⃣ Recognition Metrics
```
Recognition This Week: 24 recognitions
↑ 12% vs last week
(Great engagement!)
```

### 4️⃣ Quick Tip
```
💡 Consider distributing budget to leads 
with high usage to keep the momentum going!
```

## How It Works

### Smart Features
- ✅ Automatically fetches manager's direct reports
- ✅ Calculates budget usage percentage automatically
- ✅ Highlights leads with 80%+ budget usage
- ✅ Compares this week vs last week recognitions
- ✅ Shows only top 3 team leads (sorted by usage)
- ✅ Responsive design (mobile/tablet/desktop)

### Data Sources
```javascript
// Fetched data
- Tenant budget: tenantsAPI.getById(tenant_id)
- Team leads: usersAPI.getDirectReports(manager_id)
- Recognition stats: recognitionAPI.getTenantStats(tenant_id)

// Real-time calculated
- Budget usage %: (spent / earned) * 100
- Needs top-up: usage >= 80%
- Recognition change: ((this_week - last_week) / last_week) * 100
```

## Example Output

```
┌────────────────────────────────────────────┐
│ Good morning, Rajesh! 👋                  │
│ Here's your snapshot for today:           │
│                                            │
│ Master Pool                         💳    │
│ ₹85,000                                   │
│ Available for distribution to your team   │
│                                            │
│ Team Lead Status:                         │
│ ⚠️  Sita     85% used ₹2,500 remaining   │
│ Raj       45% used ₹15,000 remaining   │
│                                            │
│ Recognition This Week              📈    │
│ 24 recognitions          +12%             │
│ vs. last week — Great engagement!        │
└────────────────────────────────────────────┘

💡 Quick Tip
Consider distributing budget to leads with
high usage to keep the momentum going!
```

## Integration

### File Locations
- **Component**: `frontend/src/components/MorningBriefing.jsx`
- **Dashboard**: `frontend/src/pages/Dashboard.jsx` (lines ~40)
- **TeamHub**: `frontend/src/pages/TeamHub.jsx` (lines ~7)

### Import
```jsx
import MorningBriefing from '../components/MorningBriefing'
```

### Usage
```jsx
{/* In Dashboard */}
{isManager && <MorningBriefing />}

{/* In TeamHub */}
<MorningBriefing />
```

## Customization

### Change Alert Threshold
Find in `MorningBriefing.jsx`:
```javascript
// Line ~42: Change 80 to another percentage
needsTopUp: budgetUsagePercent >= 80  // Change this value
```

### Change Number of Leads Shown
Find in `MorningBriefing.jsx`:
```javascript
// Line ~130: Change 3 to another number
{teamLeadAlerts.slice(0, 3).map(lead => ...)}
```

### Modify Message Text
All text strings are in the JSX markup:
- Line 109: "Good morning..." message
- Line 130: "Team Lead Status" label
- Line 139: "Top-up recommended" message
- Line 149: "Master Pool" label

## Performance

- **Data Caching**: Uses React Query for automatic caching
- **Lazy Loading**: Component only loads when needed
- **Optimized**: Only fetches team leads data once per session
- **Real-time**: Updates when navigation occurs

## Accessibility

- ✅ Proper color contrast (WCAG AA)
- ✅ Icon + text labels for clarity
- ✅ Responsive text sizing
- ✅ Semantic HTML structure
- ✅ Aria-friendly

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Common Questions

**Q: Why doesn't the Morning Briefing show for me?**
A: You need to be a `tenant_manager` or `tenant_lead` role. Check your org_role in user settings.

**Q: Can I hide the Morning Briefing?**
A: Not currently, but we can add a preference toggle in future versions.

**Q: How often does data refresh?**
A: Data auto-refreshes when you navigate between pages. Manual refresh coming in v2.

**Q: What if a lead has no wallet data?**
A: Gracefully handles with "₹0" and defaults to 0% usage.

---

**Implementation Date**: Feb 4, 2026  
**Component**: MorningBriefing  
**Status**: ✅ Production Ready
