# Mobile Medical Disclaimer Patches

These patches add inline "not for medical decisions — consult your care team" disclaimers to
every mobile screen that surfaces health data to the user. Mobile is owned by Shreyash; these
are diffs only — do not merge without Shreyash's review.

---

## 1. `apps/mobile/app/(tabs)/labs.tsx`

Add a disclaimer banner immediately above the `ScrollView` content. Insert after the
`<View style={{ flex: 1, backgroundColor: theme.bg }}>` header block (after line 148):

```diff
--- a/apps/mobile/app/(tabs)/labs.tsx
+++ b/apps/mobile/app/(tabs)/labs.tsx
@@ labs.tsx (inside LabsScreen return, after the header View, before ScrollView) @@

+        {/* Medical disclaimer */}
+        <View
+          style={{
+            marginHorizontal: 20,
+            marginTop: 8,
+            paddingHorizontal: 12,
+            paddingVertical: 6,
+            borderRadius: 8,
+            backgroundColor: 'rgba(99,102,241,0.08)',
+            borderWidth: 1,
+            borderColor: 'rgba(99,102,241,0.18)',
+          }}
+        >
+          <Text style={{ color: theme.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
+            Not for medical decisions — always consult your care team.
+          </Text>
+        </View>
```

**Placement**: between the header `<View>` (paddingBottom: 12, borderBottom…) and the
`<ScrollView>`.

---

## 2. `apps/mobile/src/components/TodaysMedicationsCard.tsx`

Add disclaimer at the bottom of the populated medications list (after all `med.map()` rows,
before the closing `</View>` of the card padding):

```diff
--- a/apps/mobile/src/components/TodaysMedicationsCard.tsx
+++ b/apps/mobile/src/components/TodaysMedicationsCard.tsx
@@ TodaysMedicationsCard.tsx (inside the return for meds.length > 0, after meds.map()) @@

+        {/* Disclaimer */}
+        <Text
+          style={{
+            color: theme.textMuted,
+            fontSize: 10,
+            marginTop: 8,
+            textAlign: 'center',
+            lineHeight: 14,
+          }}
+        >
+          Not for medical decisions — consult your care team.
+        </Text>
```

**Placement**: after the closing `</View>` of the last `meds.map()` item, before `</View>`
(the outer padding view at line ~244).

---

## 3. `apps/mobile/app/health-summary.tsx`

Add disclaimer below the rendered summary content. The summary is rendered via
`<MarkdownText text={summary} theme={theme} />`. After that component, add:

```diff
--- a/apps/mobile/app/health-summary.tsx
+++ b/apps/mobile/app/health-summary.tsx
@@ health-summary.tsx (after the MarkdownText summary render, before closing GlassCard) @@

+          <View
+            style={{
+              marginTop: 16,
+              paddingTop: 12,
+              borderTopWidth: StyleSheet.hairlineWidth,
+              borderTopColor: 'rgba(255,255,255,0.08)',
+            }}
+          >
+            <Text
+              style={{
+                color: theme.textMuted,
+                fontSize: 11,
+                textAlign: 'center',
+                lineHeight: 16,
+              }}
+            >
+              For informational purposes only — not for medical decisions.{'\n'}
+              Always verify with your healthcare provider.
+            </Text>
+          </View>
```

---

## 4. `apps/mobile/src/components/Timeline.tsx`

The Timeline renders medication, lab, and symptom items inline. Add a footer disclaimer
at the end of the list (after all timeline items, before the component's closing `</View>`
or `</ScrollView>`):

```diff
--- a/apps/mobile/src/components/Timeline.tsx
+++ b/apps/mobile/src/components/Timeline.tsx
@@ Timeline.tsx (after the last timeline item render, before closing ScrollView/View) @@

+    {/* Disclaimer footer */}
+    <Text
+      style={{
+        color: theme.textMuted,
+        fontSize: 10,
+        textAlign: 'center',
+        paddingHorizontal: 20,
+        paddingVertical: 12,
+        lineHeight: 14,
+      }}
+    >
+      Not for medical decisions — always consult your care team.
+    </Text>
```

---

## Review checklist for Shreyash

- [ ] Verify `theme.textMuted` resolves correctly in both light and dark modes
- [ ] Confirm disclaimer is visible and not clipped on small screens (SE, mini)
- [ ] Confirm disclaimer does not overlap tab bar safe area
- [ ] Test that empty-state screens (no labs, no meds) do not show the disclaimer
  (disclaimer should only appear when health data is present — items 1 and 2 above
  are already gated behind data presence)
