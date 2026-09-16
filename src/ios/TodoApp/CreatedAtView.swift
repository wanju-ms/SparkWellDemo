import SwiftUI

struct CreatedAtView: View {
    @Environment(\.locale) private var locale
    @Environment(\.timeZone) private var timeZone
    let value: String?
    var label = "Created at"
    var emptyValue = "Not created yet"

    static func date(from value: String?) -> Date? {
        guard let value else { return nil }
        return (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value))
            ?? (try? Date.ISO8601FormatStyle().parse(value))
    }

    private var displayValue: String {
        guard value != nil else { return emptyValue }
        guard let date = Self.date(from: value) else { return "Unavailable" }
        return date.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened, locale: locale, timeZone: timeZone))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.medium))
            Text(displayValue)
                .font(.caption)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(displayValue)
    }
}