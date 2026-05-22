// ios/CareCompanion/ScreenCaptureManager.swift
//
// Native module that observes UIScreen.capturedDidChangeNotification (iOS 11+) and
// forwards capture-state changes to React Native as "screenCaptureChanged" events.
//
// Uses startObserving / stopObserving lifecycle (called by RCTEventEmitter base class
// when JS listener count goes 0→1 and 1→0 respectively) so we only hold the
// NotificationCenter observer while the JS side is actually listening.
//
// NOTE: UIScreen.main is deprecated in iOS 16+ in favour of windowScene.screen, but
// remains functional through iOS 18. Updating to windowScene requires the module to
// receive a UIWindowScene reference, which adds complexity without practical benefit
// for our min-deployment target. Revisit when Apple actually removes the API.
import UIKit

@objc(ScreenCaptureManager)
class ScreenCaptureManager: RCTEventEmitter {

  // MARK: - RCTEventEmitter

  override func supportedEvents() -> [String]! {
    return ["screenCaptureChanged"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // MARK: - Observer lifecycle

  override func startObserving() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(captureStatusChanged),
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )
  }

  override func stopObserving() {
    NotificationCenter.default.removeObserver(
      self,
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )
  }

  // MARK: - Notification handler

  @objc private func captureStatusChanged() {
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(
        withName: "screenCaptureChanged",
        body: ["isCaptured": UIScreen.main.isCaptured]
      )
    }
  }

  // MARK: - JS-callable methods

  @objc func isCaptured(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(UIScreen.main.isCaptured)
    }
  }
}
