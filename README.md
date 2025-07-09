# Sehaj Path App

A React Native mobile application designed to help users maintain a consistent habit of doing the Sehaj Path daily. The app provides a digital platform for tracking reading progress, managing multiple reading sessions, and maintaining reading streaks.

## 🎯 Project Overview

Sehaj Path is a traditional Sikh practice of reading the complete Guru Granth Sahib Ji (the holy scripture) over a period of time. This app digitizes this spiritual practice by providing:

- **Progress Tracking**: Monitor your reading progress through 1430 Angs 
- **Multiple Paths**: Manage multiple reading sessions simultaneously
- **Reading Analytics**: View completion dates, reading streaks, and progress statistics
- **Customizable Reading Experience**: Adjustable font sizes, reading formats, and navigation

## ✨ Features

### Core Features
- **Home Dashboard**: Overview of all reading paths with progress indicators
- **Reading Interface**: Clean, distraction-free reading experience with Gurbani text
- **Progress Management**: Automatic saving of reading position and progress
- **Path Navigation**: Easy navigation between different Angs and reading sessions
- **Completion Tracking**: Automatic detection and celebration of completed paths

### Reading Experience
- **Font Size Customization**: Adjustable text size for comfortable reading
- **Larivaar Support**: Option to read in continuous text format
- **Punjabi/English Numbers**: Toggle between Punjabi and English number formats
- **Auto-scroll**: Automated reading progression with pause/resume functionality
- **Swipe Navigation**: Gesture-based navigation between pages

### Data Management
- **Local Storage**: All data stored locally using AsyncStorage
- **Progress Persistence**: Automatic saving of reading position and progress
- **Path Renaming**: Customize path names for better organization
- **Reading History**: Track daily reading progress and completion dates

## 🏗️ Architecture

### Project Structure
```
my-sehaj-path-app/
├── android/               # Android-specific configuration
├── ios/                   # iOS-specific configuration
├── assets/                # Images, fonts, and static resources
├── components/            # Reusable UI components
│   ├── Settings/          # Settings-specific components
│   └── index.ts           # Component exports
├── constants/             # Application constants and configurations
├── hooks/                 # Custom React hooks
├── icons/                 # SVG icons and graphics
├── screens/               # Main application screens
├── styles/                # Component-specific styling
├── utils/                 # Utility functions and database helpers
├── __tests__/             # Test files
├── App.tsx                # Main application component
├── index.ts               # Application entry point
└── package.json           # Dependencies and scripts
```

### Key Components

#### Screens
- **SplashScreen**: Initial loading screen
- **HomeScreen**: Main dashboard showing all reading paths
- **ContinueScreen**: Resume reading from saved position
- **PathScreen**: Main reading interface with Gurbani text
- **Settings**: App configuration and preferences
- **Error**: Error handling screen

#### Components
- **AngsNavigation**: Navigation between different Angs
- **Calendar**: Reading streak and progress visualization
- **PrimaryCard/SecondaryCard**: Path display cards
- **Slider**: Horizontal scrolling for multiple paths
- **PrimaryButton/SecondaryButton**: Action buttons
- **Text Components**: Various text display components (Headline, Label, etc.)

#### Hooks
- **useLocal**: Local storage management and data persistence
- **useInternet**: Network connectivity monitoring

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd my-sehaj-path-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **iOS Setup** (macOS only)
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Start Metro bundler**
   ```bash
   npm start
   # or
   yarn start
   ```

5. **Run the application**

   **For Android:**
   ```bash
   npm run android
   # or
   yarn android
   ```

   **For iOS:**
   ```bash
   npm run ios
   # or
   yarn ios
   ```

## 📱 Usage Guide

### Starting a New Path
1. Open the app and tap "START" on the home screen
2. A new reading path will be created automatically
3. You'll be taken to the reading interface starting from Ang 1

### Continuing a Path
1. On the home screen, you'll see "Sehaj Path in Progress" section
2. Tap on any path card to resume reading from your last position
3. Your progress is automatically saved as you read

### Reading Interface
- **Navigation**: Use left/right arrow buttons to move between Angs
- **Auto-scroll**: Enable auto-scroll for continuous reading
- **Font Size**: Adjust text size in Settings for comfortable reading
- **Larivaar**: Toggle between regular and continuous text format
- **Progress**: View your current Ang number and completion percentage

### Managing Multiple Paths
- Start multiple reading sessions simultaneously
- Each path tracks progress independently
- Rename paths for better organization
- View completion dates for finished paths

### Settings
- **Font Size**: Choose from Small, Medium, Large, or Extra Large
- **Number Format**: Switch between Punjabi and English numbers
- **Larivaar**: Enable/disable continuous text format
- **Path Management**: Rename existing paths

## 🔧 Configuration

### Environment Setup
The app uses several key dependencies:
- **React Navigation**: For screen navigation
- **AsyncStorage**: For local data persistence
- **React Native Elements**: For UI components
- **Axios**: For network requests
- **Day.js**: For date manipulation

### Key Constants
- **Total Angs**: 1430 (complete Guru Granth Sahib Ji)
- **Default Font Size**: 18px
- **Default Number Format**: Punjabi

## 🧪 Testing

Run the test suite:
```bash
npm test
# or
yarn test
```

## 📦 Build

### Android
```bash
cd android
./gradlew assembleRelease
```

### iOS
```bash
cd ios
xcodebuild -workspace SehajPathApp.xcworkspace -scheme SehajPathApp -configuration Release
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with React Native
- Gurbani database integration
- Sikh community feedback and testing
- Open source contributors

## 📞 Support

For support, questions, or feature requests, please open an issue in the repository.

---

**Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh** 🙏🏽
