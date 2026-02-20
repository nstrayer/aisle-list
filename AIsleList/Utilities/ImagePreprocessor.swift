import UIKit

// MARK: - Image Preprocessor

struct ImagePreprocessor {

    // MARK: Constants (match React source exactly)

    static let maxLongestEdge: CGFloat = 1568
    static let maxBase64Bytes: Int = 5_242_880 // 5 * 1024 * 1024
    static let initialQuality: CGFloat = 0.85
    static let minQuality: CGFloat = 0.40
    static let qualityStep: CGFloat = 0.10
    static let fallbackLongestEdge: CGFloat = 1092

    private static let thumbnailMaxWidth: CGFloat = 400
    private static let thumbnailQuality: CGFloat = 0.6

    // MARK: - Public API

    /// Preprocesses an image for the Anthropic API.
    ///
    /// Algorithm:
    /// 1. Resize so longest edge <= maxLongestEdge (never upscale)
    /// 2. JPEG compress at initialQuality
    /// 3. If base64 > 5MB, reduce quality in steps of qualityStep
    /// 4. If still too big at minQuality, resize to fallbackLongestEdge and compress at minQuality
    ///
    /// Returns the JPEG data and its base64 representation.
    static func preprocessForAPI(_ image: UIImage) -> (data: Data, base64: String) {
        let naturalWidth = image.size.width
        let naturalHeight = image.size.height

        // Step 1: Resize to maxLongestEdge
        var resized = resize(image, maxEdge: maxLongestEdge)

        // Step 2: Compress at initial quality
        var quality = initialQuality
        var data = resized.jpegData(compressionQuality: quality) ?? Data()
        var base64 = data.base64EncodedString()

        // Step 3: Progressively reduce quality if base64 exceeds limit
        while base64ByteSize(base64) > maxBase64Bytes && quality > minQuality {
            quality -= qualityStep
            quality = max(quality, minQuality)
            data = resized.jpegData(compressionQuality: quality) ?? Data()
            base64 = data.base64EncodedString()
        }

        // Step 4: Last resort -- resize to fallback dimensions at minimum quality
        if base64ByteSize(base64) > maxBase64Bytes {
            resized = resize(image, maxEdge: fallbackLongestEdge)
            data = resized.jpegData(compressionQuality: minQuality) ?? Data()
            base64 = data.base64EncodedString()
        }

        return (data: data, base64: base64)
    }

    /// Creates a 400px-wide JPEG thumbnail at 0.6 quality.
    static func createThumbnail(_ image: UIImage) -> Data? {
        let aspectRatio = image.size.height / image.size.width
        let targetWidth = min(thumbnailMaxWidth, image.size.width)
        let targetHeight = round(targetWidth * aspectRatio)
        let targetSize = CGSize(width: targetWidth, height: targetHeight)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let thumbnailImage = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        return thumbnailImage.jpegData(compressionQuality: thumbnailQuality)
    }

    // MARK: - Private Helpers

    /// Resizes an image proportionally so the longest edge fits within maxEdge.
    /// Never upscales.
    private static func resize(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
        let width = image.size.width
        let height = image.size.height
        let longestEdge = max(width, height)

        // Never upscale
        guard longestEdge > maxEdge else { return image }

        let scale = maxEdge / longestEdge
        let targetWidth = round(width * scale)
        let targetHeight = round(height * scale)
        let targetSize = CGSize(width: targetWidth, height: targetHeight)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }

    /// Calculates the decoded byte count from a base64 string length without decoding.
    /// Accounts for padding characters.
    private static func base64ByteSize(_ base64: String) -> Int {
        let length = base64.count
        guard length > 0 else { return 0 }

        var padding = 0
        if base64.hasSuffix("==") {
            padding = 2
        } else if base64.hasSuffix("=") {
            padding = 1
        }

        return (length * 3) / 4 - padding
    }
}
