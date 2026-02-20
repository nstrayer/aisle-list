import SwiftUI

// MARK: - Store Sections

enum StoreSections {

    // MARK: Section Keywords

    /// Dictionary mapping section names to keyword arrays for categorization.
    static let storeSections: [String: [String]] = [
        "Produce": [
            "lettuce", "tomato", "cucumber", "onion", "garlic", "potato",
            "carrot", "celery", "pepper", "apple", "banana", "orange",
            "lemon", "lime", "berry", "berries", "strawberry", "grape",
            "melon", "avocado", "mushroom", "spinach", "kale", "broccoli",
            "cauliflower", "zucchini", "squash", "green onion", "cherry tomato",
        ],
        "Meat & Seafood": [
            "chicken", "beef", "pork", "turkey", "fish", "salmon",
            "shrimp", "steak", "ground beef", "sausage", "bacon", "ham",
            "chicken breast", "thigh",
        ],
        "Dairy & Eggs": [
            "milk", "cheese", "yogurt", "butter", "cream", "egg", "eggs",
            "sour cream", "cottage cheese", "half and half", "dairy milk",
            "almond milk", "oat milk", "noosa", "lil noosas",
        ],
        "Frozen Foods": [
            "ice cream", "frozen", "pizza", "frozen vegetables",
            "frozen fruit", "frozen dinner", "popsicle", "frozen berries",
        ],
        "Bakery": [
            "bread", "bagel", "roll", "rolls", "bun", "croissant",
            "muffin", "donut", "cake", "tortilla", "pita", "bagel bags",
        ],
        "Pantry & Canned Goods": [
            "rice", "pasta", "bean", "beans", "soup", "cereal", "oatmeal",
            "flour", "sugar", "canned", "tomato sauce", "broth", "stock",
            "campbell", "cannellini beans", "chickpea", "lentil", "chili bean",
        ],
        "Condiments & Sauces": [
            "ketchup", "mustard", "mayo", "mayonnaise", "hot sauce",
            "soy sauce", "olive oil", "vegetable oil", "vinegar",
            "salad dressing", "bbq sauce", "salsa", "canola oil",
            "sesame oil", "avocado oil", "coconut oil", "honey", "jam",
            "jelly", "peanut butter",
        ],
        "International": [
            "tofu", "miso", "curry", "sushi", "ramen", "noodles",
            "kimchi", "tahini", "shawarma", "naan",
        ],
        "Snacks": [
            "chip", "chips", "cracker", "cookie", "candy", "chocolate",
            "popcorn", "pretzel", "nut", "nuts", "granola", "trail mix",
        ],
        "Beverages": [
            "water", "juice", "soda", "coffee", "tea", "beer", "wine",
            "sparkling",
        ],
        "Household & Cleaning": [
            "paper towel", "toilet paper", "tissue", "kleenex", "detergent",
            "soap", "shampoo", "dish soap", "cleaning", "trash bag",
            "laundry", "tide", "tide pods",
        ],
        "Other": [],
    ]

    // MARK: Section Order

    /// Ordered array matching the typical Kroger store layout.
    static let sectionOrder: [String] = [
        "Produce",
        "Bakery",
        "Meat & Seafood",
        "Dairy & Eggs",
        "Frozen Foods",
        "Pantry & Canned Goods",
        "International",
        "Condiments & Sauces",
        "Snacks",
        "Beverages",
        "Household & Cleaning",
        "Other",
    ]

    // MARK: Section Styles

    struct SectionStyle {
        let background: Color
        let text: Color
        let border: Color
    }

    /// Color mapping for each known store section.
    static let sectionStyles: [String: SectionStyle] = [
        "Produce": SectionStyle(
            background: Color(.systemGreen).opacity(0.15),
            text: Color(.systemGreen),
            border: Color(.systemGreen).opacity(0.5)
        ),
        "Bakery": SectionStyle(
            background: Color(.systemOrange).opacity(0.15),
            text: Color(.systemOrange),
            border: Color(.systemOrange).opacity(0.5)
        ),
        "Meat & Seafood": SectionStyle(
            background: Color(.systemRed).opacity(0.15),
            text: Color(.systemRed),
            border: Color(.systemRed).opacity(0.5)
        ),
        "Dairy & Eggs": SectionStyle(
            background: Color(.systemBlue).opacity(0.15),
            text: Color(.systemBlue),
            border: Color(.systemBlue).opacity(0.5)
        ),
        "Frozen Foods": SectionStyle(
            background: Color(.systemCyan).opacity(0.15),
            text: Color(.systemCyan),
            border: Color(.systemCyan).opacity(0.5)
        ),
        "Pantry & Canned Goods": SectionStyle(
            background: Color(.orange).opacity(0.15),
            text: Color(.orange),
            border: Color(.orange).opacity(0.5)
        ),
        "Condiments & Sauces": SectionStyle(
            background: Color(.systemYellow).opacity(0.15),
            text: Color(.systemYellow),
            border: Color(.systemYellow).opacity(0.5)
        ),
        "International": SectionStyle(
            background: Color(.systemPurple).opacity(0.15),
            text: Color(.systemPurple),
            border: Color(.systemPurple).opacity(0.5)
        ),
        "Snacks": SectionStyle(
            background: Color(.systemPink).opacity(0.15),
            text: Color(.systemPink),
            border: Color(.systemPink).opacity(0.5)
        ),
        "Beverages": SectionStyle(
            background: Color(.systemTeal).opacity(0.15),
            text: Color(.systemTeal),
            border: Color(.systemTeal).opacity(0.5)
        ),
        "Household & Cleaning": SectionStyle(
            background: Color(.systemGray).opacity(0.15),
            text: Color(.systemGray),
            border: Color(.systemGray).opacity(0.5)
        ),
        "Other": SectionStyle(
            background: Color(.secondarySystemFill),
            text: Color(.secondaryLabel),
            border: Color(.separator)
        ),
    ]

    // MARK: Dynamic Section Colors

    /// Color palette for AI-proposed sections not in the known list.
    static let dynamicSectionColors: [SectionStyle] = [
        // violet
        SectionStyle(
            background: Color(.systemPurple).opacity(0.12),
            text: Color(red: 0.55, green: 0.24, blue: 0.85),
            border: Color(red: 0.55, green: 0.24, blue: 0.85).opacity(0.5)
        ),
        // rose
        SectionStyle(
            background: Color(.systemPink).opacity(0.12),
            text: Color(red: 0.88, green: 0.17, blue: 0.42),
            border: Color(red: 0.88, green: 0.17, blue: 0.42).opacity(0.5)
        ),
        // indigo
        SectionStyle(
            background: Color(.systemIndigo).opacity(0.12),
            text: Color(.systemIndigo),
            border: Color(.systemIndigo).opacity(0.5)
        ),
        // lime
        SectionStyle(
            background: Color(red: 0.52, green: 0.78, blue: 0.10).opacity(0.12),
            text: Color(red: 0.30, green: 0.52, blue: 0.02),
            border: Color(red: 0.52, green: 0.78, blue: 0.10).opacity(0.5)
        ),
        // fuchsia
        SectionStyle(
            background: Color(red: 0.85, green: 0.24, blue: 0.85).opacity(0.12),
            text: Color(red: 0.85, green: 0.24, blue: 0.85),
            border: Color(red: 0.85, green: 0.24, blue: 0.85).opacity(0.5)
        ),
        // sky
        SectionStyle(
            background: Color(red: 0.22, green: 0.68, blue: 0.95).opacity(0.12),
            text: Color(red: 0.02, green: 0.47, blue: 0.72),
            border: Color(red: 0.22, green: 0.68, blue: 0.95).opacity(0.5)
        ),
    ]

    // MARK: - Functions

    /// Returns the style for a section. Uses fixed colors for known sections
    /// and a deterministic hash into the dynamic palette for unknown ones.
    static func getSectionStyle(_ name: String) -> SectionStyle {
        if let style = sectionStyles[name] {
            return style
        }
        // Deterministic hash based on UTF-16 code units -- mirrors JS charCodeAt()
        var hash = 0
        for unit in name.utf16 {
            hash = (hash &+ Int(unit)) &* 31
        }
        let index = abs(hash) % dynamicSectionColors.count
        return dynamicSectionColors[index]
    }

    /// Categorizes a grocery item name into a store section via keyword substring matching.
    /// Returns the section name or "Other" if no match is found.
    static func categorizeItem(_ name: String) -> String {
        let lowerItem = name.lowercased()

        for section in sectionOrder {
            if section == "Other" { continue }
            guard let keywords = storeSections[section] else { continue }
            for keyword in keywords {
                if lowerItem.contains(keyword) {
                    return section
                }
            }
        }

        return "Other"
    }
}
