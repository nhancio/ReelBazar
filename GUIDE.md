# ReelBazaar - Running and Usage Guide

Welcome to **ReelBazaar**, the ultimate platform for fashion influencers, brands, and trend-seekers. This guide will walk you through setting up the environment to run the app and how to navigate its features.

---

## 🚀 Part 1: How to Run (Technical Setup)

### 📋 Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **npm** (v10 or higher)
- **Git**
- **Firebase Account** (for backend services)
- **Android Studio / Xcode** (only for mobile app development)

### 🛠️ 1. Initial Installation
Clone the repository and install all dependencies from the root directory:
```bash
git clone <your-repo-url>
cd ReelBazaar
npm install
```

### 🔑 2. Firebase Configuration
ReelBazaar relies on Firebase for Authentication, Firestore, and Storage.

#### **Backend Setup:**
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. **Service Account:** Project Settings > Service Accounts > Generate new private key.
4. Rename the downloaded JSON to `serviceAccountKey.json` and place it in `backend/server/`.
5. **Environment Variables:**
   ```bash
   cp backend/server/.env.example backend/server/.env
   # Edit .env with your FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET
   ```

#### **Web/Mobile Frontend Setup:**
1. In Firebase Console, add a "Web App" to your project.
2. Copy the config object (apiKey, authDomain, etc.).
3. **Environment Variables:**
   ```bash
   cp apps/web-app/.env.example apps/web-app/.env
   # Fill in the VITE_FIREBASE_* values with your config
   ```

### 🏃 3. Starting the App
You can run all components simultaneously or individually from the root:

| Action | Command |
| :--- | :--- |
| **Run All (Dev Mode)** | `npm run dev` |
| **Backend Only** | `npm run dev:backend` |
| **Web App Only** | `npm run dev:web` |
| **Landing Page Only** | `npm run dev:landing` |

### 📊 4. Seeding Demo Data
To quickly populate the app with demo reels and users:
```bash
npm run db:seed
```

---

## 📱 Part 2: How to Use (User Guide)

ReelBazaar supports three distinct user types, each with unique capabilities.

### 🎭 Choose Your Persona
1. **Viewer:** Browse the latest fashion trends, save your favorite reels, and shop directly from product links.
2. **Influencer:** Upload high-quality fashion reels, build your portfolio, and get discovered by top brands.
3. **Brand:** Discover influencers that match your target audience and initiate collaborations.

### 🌟 Core Features

#### **1. The Fashion Feed (Home)**
- **Scroll:** Swipe up/down to discover fashion reels.
- **Interact:** Like, save, or share reels that inspire you.
- **Shop:** Click on the product tags within a reel to view item details.

#### **2. Creating Reels (For Influencers)**
- Tap the **"+" (Create)** icon.
- Upload your video (MP4/WebM).
- Add a catchy description and select your fashion category (e.g., Streetwear, Luxury, Casual).
- Tag products to help viewers find what you're wearing.

#### **3. AI-Powered Matching (For Brands)**
- Navigate to the **Collaborations** tab.
- Our AI matching engine suggests influencers based on your brand's category, target age group, and gender focus.
- View "Match Scores" to find the perfect partner for your next campaign.

#### **4. Messages & Collaboration**
- **Chat:** Use the built-in messaging system to discuss campaign details.
- **Manage Deals:** View your active, pending, and completed collaborations in the dedicated dashboard.

#### **5. Profile Management**
- Customize your bio, profile picture, and social links.
- View your own uploaded reels and saved items.

---

## 📱 Part 3: Running on Mobile

### **Using Capacitor (Web-to-Mobile)**
If you want to run the web app as a native mobile app:
```bash
cd apps/web-app
npm run build
npx cap sync
npx cap open android # or ios
```

### **Using React Native (Native App)**
For the dedicated native mobile experience:
```bash
cd apps/mobile-app
# iOS only
cd ios && pod install && cd ..
# Run
npx react-native run-ios # or run-android
```

---

## 💡 Pro Tips
- **Performance:** Ensure your videos are under 50MB for the best upload experience.
- **Discovery:** Influencers with complete profiles (bio + profile pic) have a 40% higher chance of being matched with brands.
- **Feedback:** Found a bug? Use the `/bug` command in the CLI or contact the dev team.
