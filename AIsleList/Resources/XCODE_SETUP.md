# Xcode Project Setup

These steps must be completed in Xcode after creating the project.

## 1. Create Xcode Project

- Open Xcode -> File -> New -> Project -> iOS -> App
- Product Name: AIsleList
- Team: (your team)
- Organization Identifier: com.aislelist
- Interface: SwiftUI
- Language: Swift
- Storage: SwiftData
- Deployment Target: iOS 17.0+

## 2. Add Source Files

Add all Swift files from this directory structure into the Xcode project.

## 3. Capabilities

In Signing & Capabilities, add:

### iCloud
- Enable CloudKit
- Create container: `iCloud.com.aislelist.app`
- SwiftData automatically syncs @Model entities when CloudKit is configured

### Camera Usage
Already declared in Info.plist:
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`

## 4. CloudKit Notes

- No code changes needed beyond project config
- SwiftData handles CloudKit sync automatically for @Model entities
- Test sync by running on two devices signed into the same iCloud account
- CloudKit Dashboard: https://icloud.developer.apple.com/

## 5. Build Settings

- Swift Language Version: 5.10+
- Minimum Deployment Target: iOS 17.0
