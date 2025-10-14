# Quick Start Guide - Frontend Setup

This guide helps you get the EcoVerifier frontend up and running quickly.

---

## Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- Modern web browser

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 289 packages, and audited 290 packages in 24s
```

### 2. Fix Security Vulnerabilities (Optional)

```bash
npm audit fix
```

### 3. Run Development Server

```bash
npm run dev
```

**Expected output:**
```
  ▲ Next.js 15.3.3
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

✓ Ready in 2.5s
```

### 4. Open in Browser

Navigate to: **http://localhost:3000**

---

## Verify Installation

### Check for Errors

1. Open browser console (F12)
2. Check for any red errors
3. Verify no "module not found" errors

### Test Basic Functionality

1. Enter a company name (e.g., "Tesla")
2. Click submit
3. Wait 30-90 seconds for results
4. Verify report displays with:
   - ✓ GreenScore with circular gauge
   - ✓ Source credibility badges
   - ✓ Audit summary
   - ✓ List of sources with links

---

## Common Issues & Solutions

### Issue: "Cannot find module 'react'"

**Solution:**
```bash
npm install
```

### Issue: "npm install" fails with execution policy error

**Solution:**
```bash
powershell -ExecutionPolicy Bypass -Command "npm install"
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Use a different port
npm run dev -- -p 3001
```

### Issue: "Network Error" when submitting company

**Possible Causes:**
1. Backend is down - Check Railway deployment
2. No internet connection - Check connectivity
3. CORS issue - Check browser console

**Solution:**
- Verify backend is running: https://greenwash-api-production.up.railway.app
- Check browser console for specific error
- Try different company name

---

## Project Structure

```
greenwash-frontend/
├── app/
│   ├── page.tsx                    # Main homepage (ESG analyzer)
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   ├── firebase.ts                 # Firebase configuration
│   ├── components/
│   │   ├── Layout.tsx              # Shared layout with header
│   │   ├── ReportsSidebar.tsx      # Sidebar for reports
│   │   ├── AddToPortfolioButton.tsx # Add company to portfolio
│   │   ├── CreatePortfolioModal.tsx # Portfolio creation modal
│   │   ├── PortfolioView.tsx       # Portfolio detail view
│   │   └── PortfolioDashboard.tsx  # Portfolio overview
│   ├── portfolios/
│   │   └── page.tsx                # Portfolio management page
│   ├── types/
│   │   └── portfolio.ts            # TypeScript types
│   └── utils/
│       └── portfolioUtils.ts       # Portfolio calculations
├── public/                         # Static assets
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── next.config.ts                  # Next.js config
└── tailwind.config.js              # Tailwind CSS config
```

---

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

### 2. Make Changes

Edit files in `app/` directory. Changes auto-reload.

### 3. Check for TypeScript Errors

```bash
npm run build
```

### 4. Fix Linting Issues

```bash
npm run lint
```

---

## Testing Checklist

### ✅ Core Functionality

- [ ] Homepage loads without errors
- [ ] Can submit company name
- [ ] Report displays with data
- [ ] GreenScore shows correctly
- [ ] Sources display with badges
- [ ] Error messages work (try "xxx")

### ✅ Portfolio Features

- [ ] Can create portfolio
- [ ] Can add companies to portfolio
- [ ] Portfolio insights calculate correctly
- [ ] Can export portfolio to CSV
- [ ] Can delete portfolio

### ✅ Visual Elements

- [ ] Source credibility badges display
- [ ] Trust scores show when available
- [ ] Impact/direction badges work
- [ ] Mobile responsive layout works
- [ ] Sidebar toggles on mobile

### ✅ Authentication (if enabled)

- [ ] Can login with Google
- [ ] Reports persist after login
- [ ] Portfolios save to Firestore
- [ ] Can logout successfully

---

## Backend Integration

### API Endpoint

```
https://greenwash-api-production.up.railway.app/generate-audit
```

### Test Backend Connection

```bash
node test-backend-connection.js
```

**Expected output:**
```
✅ All tests passed! Backend connection is working correctly.
```

### Manual API Test

```bash
curl "https://greenwash-api-production.up.railway.app/generate-audit?company=Tesla"
```

---

## Environment Variables (Optional)

Create `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://greenwash-api-production.up.railway.app
NEXT_PUBLIC_API_TIMEOUT=90000

# Firebase Configuration (if using auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

---

## Build for Production

### 1. Create Production Build

```bash
npm run build
```

### 2. Test Production Build Locally

```bash
npm start
```

### 3. Deploy

Deploy to Vercel (recommended):

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Or deploy to other platforms:
- Netlify
- Railway
- AWS Amplify
- Google Cloud Run

---

## Performance Tips

### 1. Enable Next.js Image Optimization

Use `<Image>` component from `next/image` for images.

### 2. Code Splitting

Next.js automatically code splits by page.

### 3. Lazy Loading

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
});
```

### 4. Caching

Reports are cached in:
- LocalStorage (anonymous users)
- Firestore (authenticated users)

---

## Troubleshooting

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### Runtime Errors

1. Check browser console (F12)
2. Check terminal output
3. Verify all dependencies installed
4. Check Firebase configuration
5. Verify backend is responding

---

## Support & Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)

### Project Documentation

- `BACKEND_INTEGRATION_UPDATE.md` - Backend integration details
- `BACKEND_CONNECTION.md` - API connection verification
- `UI_EXAMPLES.md` - Visual examples and design
- `PORTFOLIO_FEATURE.md` - Portfolio feature documentation

### Getting Help

1. Check error messages in browser console
2. Review documentation files
3. Check GitHub issues
4. Verify backend status on Railway

---

## Next Steps

After installation, consider:

1. **Customize branding** - Update colors, logo, text
2. **Add analytics** - Google Analytics, Mixpanel, etc.
3. **Set up monitoring** - Sentry, LogRocket, etc.
4. **Configure SEO** - Meta tags, sitemap, robots.txt
5. **Add tests** - Jest, React Testing Library
6. **Set up CI/CD** - GitHub Actions, Vercel

---

**Last Updated:** October 13, 2025  
**Status:** ✅ Ready for Development
