# Braze WebSDK Demo

A comprehensive, clean, and futuristic web application for demonstrating Braze WebSDK integration capabilities. This demo provides a complete testing environment for user data logging, in-app messages, and push notifications.

## Features

### 🚀 SDK Configuration
- **Custom API Key Input**: Enter your Braze API key securely
- **Multiple SDK Endpoints**: Support for all major Braze SDK URLs:
  - US-01 through US-08
  - EU-02
  - AP-03
- **Advanced Settings Panel**: Configure SDK options like logging, session timeout, trigger intervals, and authentication

### 👤 User Data Logging
- **Custom Attributes**: Log user attributes with support for:
  - String values
  - Numeric values
  - Boolean values
  - Date values
- **Custom Events**: Log events with optional JSON properties
- **Session Management**: Start and end user sessions manually

### 💬 In-App Messages
- **Message Triggering**: Request in-app message refresh
- **Data Flushing**: Force immediate data synchronization
- **Automatic Display**: Messages configured in Braze dashboard will display automatically

### 🪧 Banner Placements
- **Placement Showcase**: Dedicated `bannerdemo` placement renders at the top of the page
- **Manual Refresh**: Trigger banner refreshes without reloading the SDK
- **Control Handling**: Automatically hides when the user is in a control variant
- **Status Indicators**: Real-time status pill and activity log entries for banner lifecycle events

### 🔔 Push Notifications
- **Permission Management**: Request and manage browser push permissions
- **Registration Flow**: Complete push notification registration process
- **Test Notifications**: Send test notifications to verify functionality
- **Service Worker Support**: Full offline and background notification support

### 🎨 User Interface
- **Dark Mode**: Beautiful purple-themed dark interface
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Activity Log**: Track all SDK interactions and events
- **Status Indicators**: Live SDK and push notification status
- **Keyboard Shortcuts**: Quick actions for power users

## Quick Start

1. **Clone or Download**: Get the project files
2. **Serve Locally**: Use any web server (Python, Node.js, or simple file server)
3. **HTTPS Required**: For push notifications, serve over HTTPS
4. **Configure**: Enter your Braze API key and select your SDK endpoint
5. **Initialize**: Click "Initialize SDK" to start

### Example Setup with Python
```bash
# Python 3
python -m http.server 8000

# Python 2
python -SimpleHTTPServer 8000
```

### Example Setup with Node.js
```bash
npx serve .
```

## Configuration

### Required Settings
- **API Key**: Your Braze application API key
- **SDK Endpoint**: Your Braze SDK URL (e.g., US-03, EU-02)

### Optional Settings (Advanced)
- **Enable Logging**: Debug SDK operations
- **Session Timeout**: Session duration in seconds
- **Trigger Interval**: Minimum time between trigger actions
- **SDK Authentication**: Enable SDK authentication
- **User Supplied JavaScript**: Allow custom JavaScript in messages (required for Banners)
- **Push Token Maintenance**: Manage push token lifecycle

## Usage Examples

### Logging Custom Attributes
1. Navigate to "User Data Logging" → "Custom Attributes"
2. Enter attribute key (e.g., "favorite_color")
3. Enter attribute value (e.g., "blue")
4. Select value type (String, Number, Boolean, Date)
5. Click "Log Custom Attribute"

### Logging Custom Events
1. Navigate to "User Data Logging" → "Custom Events"
2. Enter event name (e.g., "product_viewed")
3. Optionally add JSON properties: `{"product_id": "123", "category": "electronics"}`
4. Click "Log Custom Event"

### Testing Push Notifications
1. Navigate to "Push Notifications"
2. Click "Request Permission" (browser will prompt)
3. Click "Register for Push" to complete setup
4. Click "Test Notification" to send a test message

### Displaying Banner Placements
1. Enable **Allow User Supplied JavaScript** in Advanced Settings
2. Initialize the SDK
3. The `bannerdemo` placement renders automatically at the top of the page
4. Use **Refresh Banner** to manually request updated banner content
5. Review banner status changes within the banner header and Activity Log

## Browser Compatibility

- **Chrome**: Full support including push notifications
- **Firefox**: Full support including push notifications
- **Safari**: Limited push notification support (macOS/iOS)
- **Edge**: Full support including push notifications

## Security Notes

- **HTTPS Required**: Push notifications require HTTPS in production
- **API Key Persistence**: API keys and form inputs persist in your browser's localStorage for convenience. Use the in-app "Clear Saved Settings" button or clear site data to remove them.
- **Settings Persistence**: Advanced settings and saved environments are stored locally in the browser
- **Service Worker**: Handles offline functionality and push notifications

## Troubleshooting

### SDK Initialization Issues
- Verify API key is correct
- Check SDK endpoint matches your Braze instance
- Review browser console for detailed error messages

### Push Notification Issues
- Ensure HTTPS is used (required for push notifications)
- Check browser permissions in settings
- Verify service worker registration in DevTools

### In-App Message Issues
- Configure campaigns in Braze dashboard
- Ensure proper user identification
- Check message triggering conditions

## File Structure

```
braze-websdk-demo/
├── index.html          # Main application interface
├── styles.css          # Futuristic purple-themed styling
├── script.js           # Core application logic and Braze integration
├── sw.js              # Service worker for push notifications
├── manifest.json      # PWA manifest for installation
└── README.md          # This documentation
```

## Development

The application is built with vanilla HTML, CSS, and JavaScript for maximum compatibility and ease of understanding. No build process or dependencies are required beyond a web server.

### Key Components
- **Braze SDK Integration**: Latest WebSDK with comprehensive configuration
- **Modern UI**: CSS Grid and Flexbox with smooth animations
- **Progressive Web App**: Full PWA support with service worker
- **Responsive Design**: Mobile-first approach with desktop optimization

## Support

For Braze-specific questions, refer to the [official Braze documentation](https://www.braze.com/docs/developer_guide/platform_integration_guides/web/initial_sdk_setup/).

For demo-specific issues, check the browser console for detailed error messages and ensure all prerequisites are met.

---

**Note**: This is a demonstration tool for testing Braze WebSDK integration. Do not use production API keys in shared environments.

