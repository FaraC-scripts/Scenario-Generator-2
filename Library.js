// Start of Scenario Generator's library
/**
 * Scenario Generator v2.0 (NSFW) by FaraC
 * Scenario Generator creates JSON-formatted scenario prompts that can be used
 * in the paired Toolbox scenario option or elsewhere. 
 * The generator uses a player-accessible outline to create hidden prompting
 * that guides the AI into creating structured outputs that match the format
 * provided in the outline. When the outline is complete, the JSON will generate.
 * This verison asks the player to select Sexual Content and Kink Content policies.
 */

// Default settings for intialization and repairing the Configure Generator card
const DEFAULT_SETTINGS = {
    general_settings: {
        description_size: 50, // The base size for fields marked as descriptive
        include_story_request_in_json: false // Inlcude initial request in final output
    },
    seed_word_settings: {
        add_random_seed_words: false, // Adds a special, random seed bloc to the prompt
        use_sfw_list: true, // If the SFW list is included in the merged list
        use_nsfw_list: true, // If the NSFW list is included in the merged list
        seed_word_count: 4, // How many randomly selected words are used
        show_seed_words: false // Whether these are shown to the player in commented text
    }
};

// Gets sent to the AI when a near-instant blank output is required.
const ABORT_OUTPUT = '\n##Ignore all prior instructions. Do not generate text. Return only the following: "OUTPUT ABORTED"';

// Manages control flow in the Input phase.
function handleGeneratorInput() {
    // We need to know if an input happened this turn
    state.inputOccurred = true;
    /** 
     * AI dungeon's error handling is inconsistent and disruptive.
     * So instead of trowing Errors, custom handling is implemented,
     * and as much of the script as possible is surrounded in try/catch blocks.
     * If an error occurs, it is added to state.errorLog.
     * When errorLog is checked, if it contains any errors,
     * the context is replaced with ABORT_OUTPUT to minimize delay and token cost
     * and the player is presented with the error log on output.
     * Errors placed in the errorLog should be simple objects with 
     * the name and message properties.
     */ 
    state.errorLog = [];
    // Settings need to be checked for updates every player action.
    updateSettings();
    // Adds the default outline as a story card if there isn't one already
    // and makes sure the outline is functional
    ensureOutline();
    // If the player enters the word "help" into input and it isn't the initial input
    state.isHelpRequired = globalThis.text.toLowerCase().includes("help") 
        && info.actionCount > 0;
    // If this is the first input, which is to say the input which occurs
    // on scenario start-up, before the player can act,
    // sepcial handling is required
    globalThis.text = info.actionCount === 0
        ? parseInitialInput()
        : state.isHelpRequired
            ? "> Help - Scenario Generator Help - ⛔ Erase After Reading ⛔"
            : "\n"; //Otherwise, inputs are not allowed, overwritten with a newline.
}

// Manages control flow in the Context phase
function handleGeneratorContext() {
    try{
        // AI Dungeon is odd and doesn't create the stop parameter on its own,
        // and will also throw an error if one is not created.
        globalThis.stop ??= false;
        // Special handling for delivering help text
        if (state.isHelpRequired) {
            // AI generation not required for delivering static help text
            globalThis.text = ABORT_OUTPUT
            return
        }
        // What the player's most recent action type was.
        // If it was continue, special handling is required.
        const actionType = history[history.length -1].type;
        // If there wasn't an input, do some required actions here
        if (!state.inputOccurred) {
            state.errorLog = [];
            updateSettings();
            ensureOutline();
        };
        // Reset this value
        state.inputOccurred = false;
        // Returns the context filtered and split by newlines
        const lines = linesFromText(globalThis.text);
        // Stores the context as an object for later reference
        state.parsedContext = stringToObject(lines);
        // Creates an outline object from the outline story card
        const outline = parseOutline();
        // Checks to see if the latest section and field used in the context
        // match the last section and field of the outline.
        // If so, generation is considered complete and JSON will be output
        // instead of AI-generated text (thus the output is aborted)
        if (isOutlineComplete(outline)) {
            state.outputJSON = true;
            globalThis.text = ABORT_OUTPUT;
            return;
        }
        // Splices a floating prompt into the lines behind the latest
        // section header, which contains tailored prompting for what the 
        // AI should output based on the current position in the outline
        insertFloatingPrompt(
            lines,
            ...generateFloatingPrompt(lines, outline)
        );
        // If there are errors, abort the output
        // Otherwise send the AI the context with inserted prompt
        globalThis.text = state.errorLog.length > 0
            ? ABORT_OUTPUT
            : lines.join("\n");
    } catch (e) {
        state.errorLog.push({
            name: "Uncaught Context Error",
            message: "An error occurred in the context and was not caught by a more specific error handler. Oops :("
        })
        globalThis.text = ABORT_OUTPUT
    }
}

// Manages control flow in the Output phase
function handleGeneratorOutput() {
    // If an error occurred in input or context, handle it here.
    if (state.errorLog.length > 0) {
        globalThis.text = handleErrors()
        return
    } 
    try{
        if (state.isHelpRequired) {
            // Turn this off so we don't get stuck in help mode
            state.isHelpRequired = false;
            // Deliver static help text
            globalThis.text = HELP_TEXT
            return
        }
        // If this flag is true, the outline is complete and it's time to
        // convert it into a JSON string for the player
        if (state.outputJSON) {
            // Make sure the flag is off so the script doesn't get stuck in JSON mode
            state.outputJSON = false
            globalThis.text = createFinalJSONString()
            return
        }
        // If the outline wasn't complete before, but is now complete 
        // after the most recent output, special handling is required.
        if (
            isOutlineComplete(
                parseOutline(),
                // Context is stored in a parsed, object form, and it's easier to
                // reassemble the context from history than reverse that process
                // So context is reassembled with the current output added
                // to check for completion.
                stringToObject(contextFromHistory()+globalThis.text)
            )
        ) { // If the outline is now complete, normalize the output like normal,
            // ensuring is spacing, linebreaks, and section heading, as well as 
            // adding comments to the end of the output that inform the player
            // how to proceed
            globalThis.text = normalizeOutput(globalThis.text) + `
//The scenario prompt is complete. Feel free to edit it now.
//When you are done, press "Continue" one more time to generate a JSON object.
//Copy the next output (edit -> ctrl-A -> ctrl-C), return to the main scenario menu (you can usually press back in the broswer), and select "Play" to get started.
`
            return
        }
        // If this is a normal (non-terminal) output, normalize the output
        globalThis.text = normalizeOutput(globalThis.text)
    } catch (e) {
        state.errorLog.push(
            {
                name: "Uncaught Output Error",
                message: "An error occurred in the output and was not caught by a more specific error handler. Oops :("
            }
        )
        globalThis.text = handleErrors()
    }
}

// Converts snake_case to Title Case. It turns out Title Case has way more 
// exceptions and rules than I thought. So this one is a pain ;-;
function snakeToTitle(snake) {
    // First the snake is broken into individual words
    const words = snake
        .replace(/^[0-9]|[^$\w]/g, '')
        .split('_');
    const titleWords = []
    for (let i = 0; i < words.length; i++) {
        const word = words[i]
        // If the word is in the caps list, it is always set to all caps
        if (ALL_CAPS_WORDS.has(word)) {
            titleWords.push(word.toUpperCase())
            continue
        }
        // If the word is in the lower case list, and it isn't
        // the first or last word, it is kept lower case 
        if (i !== 0
            && i !== words.length - 1
            && LOWER_CASE_WORDS.has(word)
        ) {
            titleWords.push(word)
            continue
        }
        // Otherwise it has the first letter capitalized
        titleWords.push(word.charAt(0).toUpperCase() + word.slice(1))
    }

    return titleWords.join(' ');
}

// This way around is so much easier :D
function titleToSnake(title) {
    // Just make it all lower case and replace spaces with underscores
    return title
        .toLowerCase()
        .replace(/\s+/g, '_');
}

// Returns the part of a string that comes after the first colon
function getAfterColon(str) {
    // Figure out where that colon is
    const colonIndex = str.indexOf(':');
    // If there isn't one return an empty string
    if (colonIndex === -1) {
        return '';
    }
    return str.substring(colonIndex + 1);  // If colon is at end, colonIndex + 1 = str.length
}

// Assembles the equivalent of globalThis.text from the Context phase, from history
function contextFromHistory() {
    return history
            .map(h => h.text)
            .join("")
}

// Breaks text into lines while filtering comments, errors, and a few other things
// Has special handling for story card entries
function linesFromText(text, isCard) {
    // Comments and error messages get filtered out
    const filters = ["//", "> Error"]
    return text
        .replace("\nRecent Story:\n", "") // AI Dungeon's header gets trimmed
        .replace(/\*+/g, "") // Asterisks get removed
        .replace(/(?<!\n)\n(?![:\n\r])(?=[^:\n\r]+(?:[\n\r]|$))/g, "") // Remove special newlines
        .split("\n") // broken into lines
        .map(l => isCard
            ? l.trim().replace("> ", "") // Remove the line start from cards
            : l.trim() // and trim the line either way
        )
        .filter(l => //remove everything that matches the filters list
            !filters.some(f => l.startsWith(f))
        )
}



/**
 *  This is the initial input used by the scenario (the Opening section):
Story Request: ${Enter a scenario request, or leave blank. Tell the AI what you want, in as much detail as you want.}
Tags: ${Enter some content tags to guide the generator, or leave blank to let the AI generate tags}

Overview
Sexual Content: ${From 0 - 10, how much sexual content should be in the story? (Enter a number)}
Kink Content: ${From 0 - 10, how much should the story focus on kinks/fetishes? (Enter a number)}
 */

// Handles the initial input, formatted as above, replacing numbers with strings
// and removing the "Tags" line if it is empty.
function parseInitialInput() {
    try{
        // Turn the first input into a cleaned array of lines split by "\n"
        const lines = linesFromText(globalThis.text);
        // Initialize the return array
        const parsedLines = [];
        // Grab player inputs from the line we know the policy to be on
        // and coerce it to a number with an index valid for the policy list
        const sexPolicyIndex = Math.max(
            Math.min(
                parseInt(getAfterColon(lines[4])) 
                || 0, 
            10), 
        0);
        // Then match to the policy
        const sexPolicy = SEXUAL_CONTENT_POLICIES[sexPolicyIndex];

        const kinkPolicyIndex = Math.max(
            Math.min(
                parseInt(getAfterColon(lines[5])) 
                || 0, 
            10), 
        0);
        const kinkPolicy = KINK_CONTENT_POLICIES[kinkPolicyIndex];
        // Kink policies start replacing "kink" with "fetish" at index 6
        // so use the apropriate word to refer to the policy
        const kinkOrFetish = kinkPolicyIndex <= 5 ? "Kink" : "Fetish";
        // If the story request line has no user input, don't include that line
        if (lines[0].trim() !== "Story Request:") parsedLines.push(lines[0]);
        // Always include these lines
        parsedLines.push(
            "",
            "Overview",
            `Sexual Content: ${sexPolicy}`,
            `${kinkOrFetish} Content: ${kinkPolicy}`
        );
        // If the tags line has no user input, don't include that line.
        // It is moved to the end of the new array so that the AI will start by
        // completing this field if it isn't already filled out
        if (lines[1].trim() !== "Tags:") parsedLines.push(lines[1]);
        // Add a final linebreak so the AI doesn't start by continuing
        // the tag list the user input (if any)
        parsedLines.push("")
        return parsedLines.join("\n")
    } catch (e) {
        // If this initialization fails somehow, there's no real way for the user
        // to repair it, so they have to start over
        return `> Error: Initial Input Error
// Something went wrong with the initial text the scenario was meant to display.
// Unfortunately, this cannot be fixed. Apologies. Please start over in a new scenario.`
    }
}

// Ensures an outline that conforms to requirements to some degree
// and resets the outline to defaults if it doesn't (or doesn't exist)
function ensureOutline() {
    // If there's already a functional outline card, a new one isn't required.
    for (const c of storyCards) {
        if (c.title === "Outline") {
            // Check if the card is a functional outline, meaning it parsed
            // correctly without producing empty sections or empty values.
            // Uses a failSoft flag that won't throw an error if the card is busted
            const outline = stringToObject(c.entry, true)
            // Goes through the outline, removing empty sections and filling empty fields
            if (repairOutline(outline)) {
                // If the outline survives repairs, set it as the card entry.
                c.entry = stringifyNestedObject(outline, true)
            } else {
                // Otherwise, return the entry to its default
                c.entry = DEFAULT_OUTLINE_ENTRY
            }
            return
        }
    }
    // If there isn't an outline, make a new one
    newStoryCard(
        "Outline",
        "Outline",
        DEFAULT_OUTLINE_ENTRY,
        DEFAULT_OUTLINE_NOTES
    )
}

// Checks if an object is empty
function isEmptyObject (obj) {
    return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
}

// Check if a value is an empty string (including trimmed)
function isEmptyString (value) {
    return typeof value === 'string' && value.trim() === '';
}

// Transformatively repairs an outline and returns true or false to indicate
// whether the repair was successful, or the outline needs to be restored to default
function repairOutline(outline) {
    // If outline is empty, return null
    if (typeof outline !== "object" || Object.keys(outline).length === 0) {
        return null;
    }
    // Process each key in the outline
    for (const key in outline) {
        if (outline.hasOwnProperty(key)) {
            const value = outline[key];
            // If value is an object
            if (typeof value === 'object' && value !== null) {
                // Recursively process nested objects
                const processed = repairOutline(value);
                // If the processed result is null (empty object was removed),
                // delete the key from the outline
                if (processed === null) {
                    delete outline[key];
                } else {
                    outline[key] = processed;
                }
            // If value is a string and if string is empty, set to "..."
            } else if (typeof value === 'string' && isEmptyString(value)) { 
                outline[key] = "...";
            }
        }
    }
    // After processing, check if the outline is now empty
    if (Object.keys(outline).length === 0) {
        return null;
    }
    return outline;
}

/**
 * Updates application settings by parsing configuration from the 
 * "Configure Generator" story card.
 * Handles type coercion for boolean/numeric values. If no settings card exists, 
 * one is created. Settings are validated and normalized against defaults.
 */
function updateSettings(newProtagonist = null) {
    // Locate the "Configure Generator" settings card from the storyCards array
    let card;
    for (const c of storyCards) {
        if (c.title === "Configure Generator") {
            card = c
            break
        };
    };
    // If settings card doesn't exist, create one and exit early
    if (!card) {
        addSettingsCard();
        return;
    };
    // Check if settings need updating (either due to content change or explicit protagonist update)
    if (
        card.entry !== state.settingsString 
        || newProtagonist
    ) {
        try{
            // Parse new settings from card entry
            state.settings = stringToObject(card.entry, true);
            // Process each setting group (e.g., general_settings)
            for (const [key, value] of Object.entries(state.settings)) {
                if (typeof value === "object") {
                    // Process nested properties within each setting group
                    for (const [innerKey, innerValue] of Object.entries(value)) {
                        // Type coercion: convert string values to boolean or integer where appropriate
                        const trimValue = innerValue.trim().toLowerCase();
                        let intValue = parseInt(trimValue);
                        if (trimValue === "true") {
                            state.settings[key][innerKey] = true;
                        }
                        if (trimValue === "false") {
                            state.settings[key][innerKey] = false;
                        }
                        if (!isNaN(intValue)) {
                            // Special handling for seed word count
                            if (innerKey === "seed_word_count") {
                                intValue = Math.max(Math.min(intValue, 50), 1)
                            }
                            state.settings[key][innerKey] = intValue;
                        }
                    }
                }
            }
            // Ensure all expected settings exist, filling missing ones with defaults
            normalizeObject(state.settings, DEFAULT_SETTINGS);
        } catch(e) {
            // If parsing fails, revert to default settings
            state.settings = DEFAULT_SETTINGS;
        }
        // Update card entry and cached settings string with processed values
        card.entry = stringifyNestedObject(state.settings, true, true);
        state.settingsString = card.entry;
    }
}

// Adds a new Configure Generator story card
function addSettingsCard(settings = DEFAULT_SETTINGS) {
    const settingsString = stringifyNestedObject(settings, true, true)
    // Update state with the settings object provided
    // and the settings string produced
    state.settings = settings;
    state.settingsString = settingsString;
    // Add the story card with the settings string as the entry
    // and help text in the notes
    newStoryCard(
        "Configure Generator",
        "class",
        settingsString,
        SETTINGS_NOTES
    )
}

// Creates a new story card
function newStoryCard(title, type, entry, description = "", keys = "") {
    // AI Dungeon's API is really strange. I am not sure why it has to be done
    // like this, but apparently it does
    addStoryCard("!!!");
    // So a dummy card is added, located, and modified with the real data
    for(const c of storyCards) {
        if (c.title === "!!!") {
            c.title = title;
            c.type = type;
            c.entry = entry;
            c.description = description;
            c.keys = keys;
            return;
        }
    }
}

/**
 * Recursively normalizes an object to match a template.
 * @param {Object} obj - The object to be normalized (may be mutated in-place).
 * @param {Object} template - The template object providing the expected structure and default values.
 * @returns {void}
 */
function normalizeObject(obj, template) {
    // Iterate over each key defined in the template object
    Object.keys(template).forEach(k =>{
        // If the object's property is null or its type
        // differs from the template's property type,
        // replace it with the template's default value for that key
        if (
            obj[k] === null 
            || typeof obj[k] !== typeof template[k]
        ) obj[k] = template[k];
         // If the template's property is an object, recursively 
         // normalize the corresponding nested object
        if (
            typeof template[k] === "object"
        ) normalizeObject(obj[k],template[k]);
    });
}

// Turns a plain text string into an object.
// Has optional handling for cards, which have "> " before field names
function stringToObject(input, isCard, failSoft = false) {
    const parsedLines = {};
    try{
        // This function can be called with either text broken into lines,
        // or a raw string.
        const lines = Array.isArray(input)
            ? input // If already an array, keep as-is
            : typeof input === "string"
                // If it's a string, process into filtered lines
                ? linesFromText(input, isCard)
                : null; // Otherwise set to null
        // If parsing the sting failed or the input wasn't a string,
        // end early and return an empty object
        if (!lines) return parsedLines;
        let currentSection = null;
        // Iterate through the lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip empty lines
            if (!line) continue;
            // Check if line is a section header (no colon and next line has a colon or it's followed by key-value pairs)
            const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
            const hasColon = line.includes(':');
            if (!hasColon && (nextLine.includes(':') || !nextLine)) {
                // This is a section header
                const sectionKey = titleToSnake(line);
                currentSection = sectionKey;
                parsedLines[currentSection] = {};
            } else if (hasColon && currentSection) {
                // This is a key-value pair
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                // Convert key to snake_case
                const normalizedKey = titleToSnake(key)
                // Remove outer quotes if present and unescape inner quotes
                let processedValue = value;
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    processedValue = value.substring(1, value.length - 1);
                }
                // Unescape quotes (replace \" with ")
                processedValue = processedValue.replace(/\\"/g, '"');
                parsedLines[currentSection][normalizedKey] = processedValue;
            }
        }
    } catch {
        // There are some circumstances where a failed parsing does not need to 
        // result in an error, and can be handled softly.
        if (!failSoft)
            state.errorLog.push({
                name: "Context Parsing Error",
                message: "Something went wrong converting the context into a JSON object. If you've manually edited the context, make sure it conforms to the following pattern:\n//Section\n//Field Name: value\n//Field Name: value"
            })
    }
    return parsedLines
}

/**
 * Converts a nested object into a formatted string representation.
 * 
 * For each top-level key, the function creates a title section, then lists
 * all nested key-value pairs under that title. Keys are converted from snake_case
 * to Title Case for display purposes.
 * 
 * @param {Object} obj - The nested object to stringify
 * @param {boolean} [isCard=false] - Whether to apply special formatting for cards
 * @returns {string} Formatted string with sections separated by blank lines
 */
function stringifyNestedObject(obj, isCard, isSettings) {
    // Convert object entries to array of [key, value] pairs for processing
    return Object.entries(obj)
        .map(([topKey, nestedObj]) => {
        // Convert top-level key from snake_case to Title Case for display
        const topLevelTitle = snakeToTitle(topKey);
        // Process nested object entries
        const nestedEntries = Object.entries(nestedObj || {})
            .map(([nestedKey, value]) => {
            // Convert nested key from snake_case to Title Case for display
            const formattedKey = snakeToTitle(nestedKey);
            // Check if this is a settings entry 
            // and if value is numeric to determine if we need to add units
            if (isSettings && !isNaN(parseInt(value))) {
                if (formattedKey === "Floating Prompt Distance") {
                    value += " paragraphs";
                } else {
                    value += " words";
                }
            }
            // Apply special formatting if this is a story card object
            if (isCard) {
                // Format with settings-specific style: "> Key: value[units]"
                return `> ${formattedKey}: ${value}`;
            }
            // Default formatting for non-card objects: "Key: value"
            return `${formattedKey}: ${value}`;
            })
            .join('\n'); // Join nested entries with newlines
        // Combine top-level title with its nested entries
        return `${topLevelTitle}\n${nestedEntries}`;
        })
        .join('\n\n'); // Separate top-level sections with blank lines
}

// Processes outline story card data and transforms character templates
function parseOutline(context = state.parsedContext) {
    // Initialize outline as empty object to handle cases where no outline is found
    let outline = {};
    try {
        // Iterate through all story cards to find the Outline card
        for (const c of storyCards) {
            // Check if current card is of type "Outline"
            if (c.type === "Outline") {
                // Convert the outline text entry into a structured JavaScript object
                outline = stringToObject(c.entry, true);
            }
        };
        // Check if context contains overview with character information
        // This allows for dynamic character template assignment
        if (
            context.hasOwnProperty("overview")
            && (
                context.overview.hasOwnProperty("protagonist")
                || context.overview.hasOwnProperty("supporting_characters")
            )
        ) {
            // Extract protagonist and supporting characters from context
            const p = context.overview.protagonist;
            const sc = context.overview.supporting_characters;
            // Convert comma-separated supporting characters to snake_case format
            // This creates a list of normalized character identifiers
            const secondaryList = sc
                .split(',')
                .map(c => titleToSnake(c.trim()));
            // Create new outline object to store transformed structure
            const newOutline = {};
            // Process each key from the original outline
            for (const k of Object.keys(outline)) {
                // Special handling for character_template section
                if (k === "character_template") {
                    // Apply protagonist template if protagonist exists
                    if (p) newOutline.protagonist = outline[k]; 
                    // Skip supporting characters if the field is marked as N/A or empty
                    if (!sc || sc.includes('N/A')) {
                        continue;
                    }
                    // Apply the same character template to all supporting characters
                    // Each supporting character gets their own entry with the template
                    for (const s of secondaryList) newOutline[s] = outline[k];
                    continue;
                }
                // Copy all non-character_template keys directly to new outline
                newOutline[k] = outline[k];
            }
            // Return the transformed outline with character templates applied
            return newOutline;
        }
    } catch(e) {
        state.errorLog.push({
            name: "Outline Parsing Error",
            message: "Something went wrong converting the Outline story card into a JSON object. If you've manually edited this story card, make sure it conforms to the following pattern:\n//Section\n//Field Name: value\n//Field Name: value"
        });
    }
    // Return original outline if no transformation occurred or if error was caught
    return outline;
}

// Determines whether the outline structure is complete based on the current context.
// Compares the deepest nested property path of the outline with the current context
// to check if the user has navigated through the entire outline structure.
function isOutlineComplete(outline, context = state.parsedContext) {
    // Get the deepest nested property path in the outline structure
    // Returns [parentPath, lastKey] where parentPath is the path to the parent object
    // and lastKey is the final property key in the nested chain
    const [outlineP, outlineK] = findLastNestedProperty(outline);
    // Get the deepest nested property path in the current context
    // This represents where the user currently is in the navigation hierarchy
    const [contextP, contextK] = findLastNestedProperty(context);
    // Compare both the parent path and the final key to determine if
    // the current context matches the deepest point in the outline
    return outlineP === contextP
        && outlineK === contextK;
}

// Extracts the last nested key path from a two-level object structure
function findLastNestedProperty(obj) {
    // Get all top-level keys from the object
    const outerKeys = Object.keys(obj);
    // Return null if the object has no properties
    if (!outerKeys.length) return null;
    // Select the last top-level key (by insertion order in ES6+)
    const lastOuterKey = outerKeys[outerKeys.length - 1];
    // Access the nested object under the last top-level key
    const innerObj = obj[lastOuterKey];
    // Get all keys from the nested object
    const innerKeys = Object.keys(innerObj);
    // Return array with outer key and inner key (or null if nested object is empty)
    return innerKeys.length 
        ? [lastOuterKey, innerKeys[innerKeys.length - 1]] 
        : [lastOuterKey, null];
}

// Generates a structured prompt based on an outline, current context, and state.
// Dynamically assembles instructions, seed words, and continuation logic.
function generateFloatingPrompt(lines, outline, context = state.parsedContext) {
    // Extract current position within the outline from the context
    let [
        section,
        sectionIndex,
        field,
        fieldIndex,
        entry,
        remainingFields
    ] = extractContextPositionData(outline, context);
    let instructions = outline[section]?.[field]?.trim();
    let descriptionMod = null;
    let continueInstructions = "";
    let seedInstructions = "";
    let priorityInstructions = '# Priority Instructions\n## Do not output "(word count target:...)"';
    const template = [];
    let latestContextSection = section;
    // Parse any description modifier (e.g., "(D+10)") from the instruction string
    ;[descriptionMod, instructions] = parseInstructions(instructions);
    // If random seed words are enabled, generate and format seed instructions
    if (state.settings.seed_word_settings.add_random_seed_words) {
        state.seeds = selectRandomSeedWords().map(s => `"${s}"`).join(", ");
        seedInstructions = `# Seed Words
## [${state.seeds}]
## Seed words must strongly shape the output.
## Incorporate seeds conceptually and thematically. Pay attention to implicaiton and meaning.
## Incorporate seed themes immediately, even if that means dramatically shifting the story to accomodate.
## NEVER use seed words directly. If 'apple' is a seed word, set the story in an orchard but do not output the word 'apple'.
`;
    };
    // Determine if we are continuing an existing field entry or starting a new one
    if (
        lines.length
        && lines[lines.length - 1] !== ""
        && field
    ) {
        // Case: The last line ends with a colon, meaning a new field entry has 
        // been named but not written
        if (
            lines[lines.length - 1].endsWith(":")
            || lines[lines.length - 1].endsWith(": ")
        ) {
            priorityInstructions += `
## Begin by writing the entry for ${snakeToTitle(field)}.
## Do not include the field name.
## Do not output "${snakeToTitle(field)}:"`;

            if (instructions === "...") {
                continueInstructions = `\${entry for ${snakeToTitle(field)}${descriptionMod !== null ? getDescriptionText(descriptionMod) : ""}}\n`;
            };
        // Case: The last line contains content, so we are continuing an entry mid-flow
        } else {
            priorityInstructions += `
## Continue the entry for ${snakeToTitle(field)} exactly where it leaves off.
## Always resume mid-sentence if the input left off mid-sentence.
## Do not output the field name; do not output "${snakeToTitle(field)}:"`;
            if (instructions === "...") {
                continueInstructions = `\${Continue the entry for ${snakeToTitle(field)}, starting exactly where it leaves off.${descriptionMod !== null ? getDescriptionText(descriptionMod, entry) : ""}}\n`;
            } else {
                continueInstructions = `\${Continue the entry for ${snakeToTitle(field)}, starting exactly where it leaves off, with the following instructions: ${instructions}${descriptionMod !== null ? getDescriptionText(descriptionMod, entry) : ""}}\n`;
            };
        };
        state.continuation = true;
    }
    // If no fields remain in the current section, move to the next section
    if (remainingFields === 0) {
        [section, sectionIndex, fieldIndex]
            = incrementSection(outline, sectionIndex, template);
        latestContextSection = section
        if (!state.continuation) {
            state.sectionHeaderRequired = section;
        }
    }
    // Add the fields of the current section to the template prompt
    addFields(outline, section, template, fieldIndex);
    // If very few fields remain and more sections exist, preemptively add the next section
    if (
        remainingFields > 0
        && remainingFields <= 2
        && section !== "overview" // Moving to the next section from overview causes issues
        && sectionIndex < Object.keys(outline).length - 1
    ) {
        [section, sectionIndex, fieldIndex] = incrementSection(
            outline,
            sectionIndex,
            template
        );

        addFields(outline, section, template, fieldIndex);
    };
    // Assemble the final prompt string
    const prompt = `${seedInstructions}${priorityInstructions}
{
"output_template": \`
${continueInstructions}${template.join("\n")}
\`
}`;
    return [prompt, latestContextSection];
}

// Parses an instruction string, extracting an optional 
// description modifier (e.g., "(D+10)").
function parseInstructions(instructions) {
    // End early if there is no string to match
    if (typeof instructions !== "string") return [null, instructions];

    let descriptionMod = null;
    // Regex matches patterns like (D), (D+10), (D-5) at the start of the string
    const match = instructions?.match(/^\(D([+-])?(\d+)?\)(.*)/);
    if (match) {
        // Extract the numeric modifier and its sign
        if (match[2]) {
            if (match[1]) {
                descriptionMod = match[1] === '+'
                    ? parseInt(match[2])
                    : -parseInt(match[2]);
            } else {
                descriptionMod = parseInt(match[2]);
            };
        } else {
            descriptionMod = 0;
        };
        // Return the modifier and the remaining instruction text
        return [descriptionMod, match[3]];
    };
    // Return null for modifier and original instructions if no match
    return [descriptionMod, instructions];
}

// Advances the context to the next section in the outline and adds its header 
// to the template.
function incrementSection(outline, sectionIndex, template) {
    const keys = Object.keys(outline);
    // Guard against incrementing beyond the last section
    if (sectionIndex >= keys.length) return [outline, sectionIndex, template];

    sectionIndex += 1;
    const section = keys[sectionIndex];
    // Add a blank line and the new section title to the template array
    template.push(
        "",
        snakeToTitle(section)
    );
    // Return the new section name, its index, and reset fieldIndex to -1
    return [section, sectionIndex, -1];
}

// Generates a descriptive text snippet for word count target based on a modifier.
function getDescriptionText(descriptionMod, entry) {
    const entryWordCount = entry ? entry.split(" ").length : 0
    // Ensures the target word count is at least 10
    return `(word count target: ${Math.max(state.settings.general_settings.description_size + descriptionMod - entryWordCount, 10)})`;
}

// Adds all fields of a given section (starting from a specified index) to the prompt array.
function addFields(outline, section, template, fieldIndex) {
    const sectionKeys = Object.keys(outline[section]);
    // Loop through fields starting after the current fieldIndex
    for (let i = fieldIndex + 1; i < sectionKeys.length; i++) {
        let instructions = outline[section][sectionKeys[i]].trim();
        let descriptionMod = null;
        // Parse the instruction for any description modifier
        [descriptionMod, instructions] = parseInstructions(instructions);
        // Add a formatted field entry to the template array
        template.push(
            `${snakeToTitle(sectionKeys[i])}: \${${instructions}${descriptionMod !== null ? getDescriptionText(descriptionMod) : ""}}`
        );
    }
}

// Selects a specified number of unique random words from a SEED_WORDS array
function selectRandomSeedWords(count = state.settings.seed_word_settings.seed_word_count) {
    // Select or merge the correct seed word list.
    const seedWords = state.settings.seed_word_settings.use_sfw_list
        ? state.settings.seed_word_settings.use_nsfw_list
            ? [...SFW_SEED_WORDS, ...NSFW_SEED_WORDS] // Merge if both true
            : SFW_SEED_WORDS // If only SFW is true
        : state.settings.seed_word_settings.use_nsfw_list
            ? NSFW_SEED_WORDS // If only NSFW is true
            : SFW_SEED_WORDS; // If neither are true, as a backup
    // At least one seed will always be used
    if (count <= 0) count = 1;
    // Make sure count isn't too high. Large numbers could cause issues and would be slow.
    if (count > 50) count = 50;
    // Initialize result array and tracking set for unique selection
    const result = [];
    const selectedIndexes = new Set();
    // Continue until we've selected the requested number of words
    while (result.length < count) {
        // Generate a random index within the SEED_WORDS array bounds
        const randomIndex = Math.floor(Math.random() * seedWords.length);
        // Only add if this index hasn't been selected yet
        if (!selectedIndexes.has(randomIndex)) {
            // Add the word to the result and track its index
            result.push(seedWords[randomIndex]);
            selectedIndexes.add(randomIndex);
        }
    };
    // Return the array of uniquely selected seed words
    return result;
}

// Extracts latest outline position (section, subsection indices) based on current context
function extractContextPositionData(outline, context) {
    // Get all top-level section keys from the outline
    const keys = Object.keys(outline);
    // Iterate through sections in reverse order (most recent/last first)
    for (let i = keys.length - 1; i >= 0; i-- ) {
        // Check if context has this section key with an empty object value
        if (context[keys[i]] && isEmptyObject(context[keys[i]])) {
            // Return: [section, sectionIndex, field, fieldIndex, remainingFields]
            return [keys[i], i, null, -1, "", Object.keys(outline[keys[i]]).length];
        }
        // Get all subsection keys for the current section
        const innerKeys = Object.keys(outline[keys[i]]);
        // Iterate through subsections in reverse order
        for (let j = innerKeys.length - 1; j >= 0; j--) {
            // Check if context has both this section AND subsection
            // Indicating this is the last section completed
            if (
                context.hasOwnProperty(keys[i])
                && context[keys[i]].hasOwnProperty(innerKeys[j])
            ) {
                // Return: [section, sectionIndex, field, fieldIndex, remainingFields]
                return [
                    keys[i],
                    i,
                    innerKeys[j],
                    j,
                    context[keys[i]][innerKeys[j]],
                    innerKeys.length - (j + 1)
                ];
            };
        };
    };
    // Default fallback: return overview data if no context match found
    return ["overview", 0, null, -1, "", Object.keys(outline.overview)?.length || 5];
}

// Places the floating prompt into the lines of context at a set position
function insertFloatingPrompt(lines, floatingPrompt, section){
        // Finds the correct insertion index (behind the latest section heading)
        const insertionIndex = findInsertionIndex(lines, section);
        // Transformatively insert into lines
        lines.splice(insertionIndex, 0, floatingPrompt);
}

// Finds the correct insertion index for floating prompts
function findInsertionIndex(lines, section) {
    // Starting at the end of the lines of context, iterate backwards
    for(let i = lines.length - 1; i >= 0; i--) {
        // When the section title is found, return that index
        const sectionTitle = snakeToTitle(section);
        if (lines[i].trim() === sectionTitle) {
            return i;
        };
    };
    // If the latest section cannot be found, insert prompt at the front of context
    return lines.length - 1;
}

// Normalizes and formats text output for consistent display, handling formatting rules,
// section headers, seed words, continuation logic, and field completion detection.
function normalizeOutput(text) {
    // Get the last text entry from history for comparison
    const lastText = history[history.length - 1].text;
    // Process input text through multiple formatting stages
    const outputLines = text
        .replace(/\*/g, '') // Remove asterisks from the text
        .split("\n") // Split into individual lines
        .filter(l => l) // Filter out empty lines
        // Add newline before lines that don't contain colons (non-field lines)
        .map(l => l.includes(':') ? l : "\n" + l)
        .map(l => { // Process N/A handling
            // If it is a field and it has N/A anywhere, the value should just be N/A
            return l.includes("N/A") && l.includes(':')
                ? `${l.split(':')[0]}: N/A`
                : l
        });
    // Add section header if required and not in continuation mode
    if (state.sectionHeaderRequired && !state.continuation) {
        const sectionHeader = snakeToTitle(state.sectionHeaderRequired);
        state.sectionHeaderRequired = false;
        // Add header if not already present
        if (!outputLines[0].includes(sectionHeader)) {
            outputLines.splice(0, 0, "\n" + sectionHeader);
        }
    }
    // Add seed words line if enabled in settings
    if (
        state.settings.seed_word_settings.add_random_seed_words 
        && state.settings.seed_word_settings.show_seed_words
    ){
        const seedLine = `// Seed Words: ${state.seeds}`;
        // Insert seed line at appropriate position based on context
        if(state.continuation || outputLines[0].startsWith("\n")){
            outputLines.splice(1, 0, seedLine);
        } else {
            outputLines.splice(0, 0, seedLine);
        }
    };
    // Add leading newline if starting new output and last text didn't end with newline
    if (!state.continuation && lastText[lastText.length -1] !== '\n') 
        outputLines.splice(0,0,"\n");
    // Join processed lines back into a single string
    let output = outputLines.join("\n");
    // Handle continuation mode formatting
    if (state.continuation) {
            state.continuation = false;
            // Remove leading newlines from continuation
            output = output.replace(/^\n+/, '');
            // Remove leading ellipsis if present
            if (output.startsWith("...")) output = output.substring(3);
            // Add space between words if needed for proper concatenation
            if (
                ![' ', '-'].includes(lastText[lastText.length - 1])
                && ![' ', '-', '.', ',' ].includes(output[0])
            ) output = " " + output;
    }
    // Add trailing newline if the last line indicates field completion
    if (
        isFieldComplete(outputLines[outputLines.length - 1])
    ) output += "\n";

    return output;
}

// Determine if a given line from a record is considered complete based on various criteria.
function isFieldComplete(line) {
    // Extract the value portion of the line (text after the colon).
    const value = getValue(line);
    // A field is considered complete if its value meets any of the following conditions:
    if (
        value === null // No value was found (null).
        || !isNaN(value) // The value is a number (e.g., "42" or "3.14").
        || isTitleCase(value) // The value is in Title Case (e.g., "New York").
        || isCSV(value) // - The value is a comma-separated list of Title Case strings
        || value.includes("N/A") // The value contains the string "N/A".
        // The value ends with a period, a period and a single quote,
        // or a period and a double quote.
        || value.endsWith('.')
        || value.endsWith(".'")
        || value.endsWith('."')
    ) return true;
    // If none of the above conditions are met, the field is considered incomplete.
    return false;
}

// Extract the value portion from a colon-separated line (e.g., "City: London" -> "London").
function getValue(line) {
  // Find the first colon in the line.
  const colonIndex = line.indexOf(':');
  // If no colon is found, there is no valid value to extract.
  if (colonIndex === -1) {
    return null;
  }
  // Return the substring after the colon, with leading/trailing whitespace removed.
  return line.substring(colonIndex + 1).trim();
}

// Check if a string is a comma-separated list of Title Case strings.
function isCSV(value) {
    // Split the string into an array using the comma as a delimiter.
    const values = value.split(',')
    // If there is only one element (or none), it's not a valid CSV list for this check.
    if (values.length <= 1) return false
    // Check every element in the split array to ensure it is in Title Case.
    for (const value of values) {
        if (!isTitleCase(value)) return false
    }
    // All elements are in Title Case, so the string is a valid CSV of Title Case terms.
    return true
}

// Helper function to check if a string is in title case
function isTitleCase(str) {
    if (typeof str !== 'string' || str.trim() === '') {
        return false;
    }
    // Split the string into words
    const words = str.split(/\s+/);
    // Check first and last word - these should always be capitalized
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (!isCapitalized(firstWord) || !isCapitalized(lastWord)) {
        return false;
    }
    // Check middle words
    for (let i = 1; i < words.length - 1; i++) {
        const word = cleanWord(words[i]);
        if (LOWER_CASE_WORDS.has(word.toLowerCase())) {
        // Exception word - should not be capitalized unless it's a brand name style
        // (like "In" for "In God We Trust" or "Up" for "Up the River")
        // For strict checking, we'll only allow lowercase for these
        if (isCapitalized(word) && !isLikelyBrandNameWord(word)) {
            return false;
        }
        } else {
        // Non-exception word - must be capitalized
        if (!isCapitalized(word)) {
            return false;
        }
        }
    }
    return true;
}

// Helper function to check if a word is capitalized
function isCapitalized(word) {
    if (!word || word.length === 0) return false;
    const firstChar = word[0];
    const lastChar = word[word.length - 1];
    
    // Check if first character is uppercase and second character (if exists) is lowercase
    // This handles cases like "McDonald's" where second letter is capitalized in the middle
    const isFirstCharUpper = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
    
    // Handle words with apostrophes or quotes at the beginning/end
    const cleanFirstChar = word.replace(/^['"`]/, '').replace(/['"`]$/, '')[0];
    if (!cleanFirstChar) return false;
    
    return cleanFirstChar === cleanFirstChar.toUpperCase() && cleanFirstChar !== cleanFirstChar.toLowerCase();
}

// Helper to remove punctuation from word for comparison
function cleanWord(word) {
    return word.replace(/^['"`.,;:!?()\-]+|['"`.,;:!?()\-]+$/g, '');
}

// Helper to identify words that might be intentionally capitalized
function isLikelyBrandNameWord(word) {
    // Words that are often capitalized in titles even though they're exceptions
    const brandExceptions = new Set([
        'in', 'up', 'out', 'off', 'down', 'over', 'under'
    ]);
    
    const clean = cleanWord(word).toLowerCase();
    return brandExceptions.has(clean);
}

// Creates the final JSON output for the player
function createFinalJSONString() {
    // If adding the initial story request to the JSON is enabled
    if (
        state.settings.general_settings.include_story_request_in_json
    ) {
        // Get the request from history; it should only and ever be in the first
        // history entry. If it's not there we should not proceed anyway. 
        const request = history[0].text.match(/Story Request:\s*(.+)/);
        // If a request matches and there's an overview section of the story bible
        if (request && state.parsedContext.overview){
            // Make a new bible starting with the request, so that natural ordering
            // will keep it at the top
            const newOverview = {story_request: request[1]};
            // Add the rest of the data from the overview
            Object.keys(state.parsedContext.overview)
                .forEach(k => newOverview[k] = state.parsedContext.overview[k]);
            // Overwrite the old overview             
            state.parsedContext.overview = newOverview
        };
    };
    // Create the JSON string from stored context wrapped in a story bible 
    // object. It's called a "story bible" to help the AI understand the
    // purpose of the assembled information.
    return "\n" + JSON.stringify(
        {story_bible: state.parsedContext},
        null,
        4
    );
}

// Where we go when something has gone very wrong
function handleErrors() {
    // Log the whole error list for debug purposes
    // Only shows the player the first error. All subsequent errors are likely
    // knock-on effects and not the cause of the issue.
    const firstError = state.errorLog[0];
    return `// ${firstError.name}: ${firstError.message}\n`;
}

const SEXUAL_CONTENT_POLICIES = [
    "This story is absolutely chaste. It contains no sexual or suggestive content.",
    "This story is prim, and only contains lighthearted flirtation.",
    "This story is flirtatious, but doesn't go past that.",
    "This story is romantic. It contains physical and emotional intimacy, but not outright sex.",
    "This story is sensual. It emphasizes attraction and desire. Sexual tension permeates the story, but actual sex is rare.",
    "This story is passionate.  It emphasizes lust and desire. Flirtation and sexual tension build to an eventual release.",
    "This story is steamy. It centers lust and desire. Sexual tension builds quickly, leading to periodic release.",
    "This story is erotic. It centers sex and desire. Hot and heavy from the start, events escalate to an inevitable climax.",
    "This story is explicit. It centers sex, and does so gratuitously. Sex scenes are frequent, lewd, and salacious.",
    "This story is porn. It's all about the fucking. Raunchy, lustful, and libidinal sex scenes are constant and continuous.",
    "This story is hentai. It revolves around nonstop hardcore fucking. Sex scenes are the only scenes, and they are extreme, carnal, and utterly debaucherous."
];

const KINK_CONTENT_POLICIES = [
    "This story is strictly vanilla.",
    "This story is a little kinky, but keeps it to the background.",
    "This story is a somewhat kinky. It plays around with kinks a little, but doesn't make it the focus of the story.",
    "This story is kinky. It explores kinks, but doesn't make them the focus of the story.",
    "This story is pretty kinky. It explores kinks as part of the story's central focus.",
    "This story is very kinky. It dives head first into kinks, which make up core story elements.",
    "This story is somewhat fetishistic. It plays around with fetishes, but they aren't central to the story.",
    "This story is openly fetishistic. It explores fetishes as part of the story's central focus.",
    "This story is very fetishistic. It dives head first into fetishes, which make up core story elements.",
    "This story is highly fetishistic. It delves deeply and vividly into fetishes, which make up core story elements.",
    "This story is extremely fetishistic. It revolves around exhaustively, vividly, and obscenely plumbing the depths of as many fetishes as possible. The story pushes beyond all boundaries of decency and acceptability, and is considered offensive for everyone."
];

const ALL_CAPS_WORDS = new Set([
    // Government & Military
    "cia", "fbi", "nsa", "dea", "atf", "fema", "nasa", "nato", "un", "unesco", "wto", "eu", "uk", "uss", "usa", "ussr", "kgb", "mi5", "mi6", "irs", "ssn", "faa", "tsa", "dhs", "cdc", "fda", "nih", "epa", "usda", "ftc", "fcc",
    // Technology & Internet
    "ai", "api", "ui", "ux", "url", "uri", "http", "https", "ftp", "ssh", "ssl", "tls", "ip","tcp", "udp", "dns", "html", "css", "js", "json", "xml", "yaml", "csv", "pdf", "png", "jpeg", "gif", "svg", "mp3", "mp4", "avi", "gpu", "cpu", "usb", "hdd", "ssd", "lan", "wan", "vpn", "isp", "cdn", "b2b", "b2c", "crm", "erp", "cms", "sql", "nosql", "ide", "sdk", "ajax", "cli", "gui",
    // Education & Science
    "mit", "ucla", "ucsd", "phd", "md", "mba", "jd", "bs", "ba", "ma", "gre", "gmat", "lsat", "mcat", "gpa", "stem", "dna", "rna", "hiv", "mri", "ct", "ufo",
    // Locations & Geography
    "nyc", "sf", "dc", "tx", "ca", "ny", "fl", "nafta", "usmca",
    // Common Acronyms
    "tv", "pc", "diy", "faq", "asap", "rsvp", "vip", "iq", "eq", "bc", "bce", "ce", "pm", "ps", "pov", "fyi", "btw", "imho", "afaik", "tldr", "sfw", "nsfw",
    // Automotive & Aviation
    "vin", "mpg", "hp", "rpm", "abs", "gps", "ils", "vfr", "ifr", "atc", "iata", "boac", "lhr", "jfk", 
    // Entertainment
    "imax", "hd", "uhd", "dvd", "cd", "lp", "ep", "dj", "mc", "pg", "tv", "hbo", "bbc", "cnn", "nbc", "cbs", "abc", "mtv", "vh1",
    // Sports
    "nba", "nfl", "mlb", "nhl", "mls", "fifa", "uefa", "nascar", "ncaa", "mvp", "pga", "lpga", "atp", "wta", "espn"
]);

const LOWER_CASE_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'nor', 
    'for', 'yet', 'so', 'as', 'at', 'by', 'in', 
    'of', 'on', 'to', 'up', 'with', 'from', 'into',
    'is', 'are', 'was', 'were', 'be', 'has', 'have', 
    'had', 'do', 'does', 'did'
]);

const SFW_SEED_WORDS = [
    "abyss", "labyrinth", "enigma", "silence", "echo", "whisper", "tremor",
    "fracture", "resonance", "shadow", "bloom", "wither", "rust", "glow",
    "cascade", "dissolve", "coalesce", "sunder", "mend", "churn", "stagnate",
    "vertigo", "inertia", "momentum", "nexus", "threshold", "precipice",
    "crucible", "vessel", "conduit", "prism", "lens", "filter", "hush",
    "clamor", "chaos", "order", "entropy", "synthesis", "catalyst", "residue",
    "edifice", "fragment", "debris", "monolith", "particle", "wave", "particle",
    "tether", "sever", "graft", "parched", "saturated", "flux", "static",
    "drift", "anchor", "void", "plenum", "dense", "tenuous", "opaque",
    "translucent", "luminous", "umbral", "incandescent", "smolder", "kindle",
    "quench", "scorch", "freeze", "thaw", "erode", "deposit", "submerge",
    "emerge", "descend", "ascend", "converge", "diverge", "spiral", "orbit",
    "warp", "weft", "grain", "texture", "pulse", "staccato", "legato",
    "cadence", "rhythm", "tempo", "cessation", "genesis", "zenith", "nadir",
    "cipher", "glyph", "sigil", "parable", "rune", "arcane", "mundane",
    "profane", "sacred", "visceral", "ethereal", "tangible", "ephemeral",
    "perennial", "vestige", "omen", "portent", "aura", "essence", "core",
    "husk", "pith", "marrow", "spark", "ember", "inferno", "deluge", "zephyr",
    "gale", "vortex", "quagmire", "mire", "quarry", "forge", "anvil", "hammer",
    "chisel", "scaffold", "foundation", "pillar", "keystone", "lintel",
    "rapture", "torpor", "fervor", "apathy", "verdant", "barren", "fertile",
    "arid", "lush", "desolate", "teeming", "serene", "tumultuous", "placid",
    "roil", "splice", "braid", "unravel", "knot", "weave", "fray", "hem",
    "brink", "cusp", "verge", "chasm", "crevice", "fissure", "rift", "schism",
    "gulf", "strait", "isthmus", "archipelago", "shard", "splinter", "sliver",
    "mote", "speck", "glimmer", "glisten", "shimmer", "dull", "patina",
    "tarnish", "polish", "grime", "sleek", "jagged", "smooth", "coarse",
    "brittle", "malleable", "rigid", "supple", "taut", "slack", "gnarl",
    "warp", "weft", "compression", "tension", "shear", "torque", "pendulum",
    "fulcrum", "lever", "pivot", "axis", "orbit", "trajectory", "parabola",
    "ellipse", "symmetry", "asymmetry", "balance", "imbalance", "counterpoint",
    "harmony", "dissonance", "cacophony", "melody", "refrain", "chorus",
    "verse", "stanza", "prose", "meter", "scribe", "etch", "inscribe",
    "efface", "obscure", "reveal", "obfuscate", "clarify", "distill", "taint",
    "purge", "cleanse", "defile", "consecrate", "taint", "pristine", "corrupt",
    "virtuous", "vile", "magnificent", "wretched", "sublime", "ridiculous",
    "profound", "trivial", "momentous", "insignificant", "colossal", "minuscule",
    "finite", "infinite", "bounded", "limitless", "quantum", "singularity",
    "plurality", "solitude", "chorus", "covenant", "pact", "vow", "oath",
    "decree", "edict", "mandate", "anarchy", "tyranny", "utopia", "dystopia",
    "haven", "wasteland", "oasis", "mirage", "phantom", "specter", "wraith",
    "beacon", "lighthouse", "fog", "mist", "haze", "clear", "murky", "turbid",
    "prism", "spectrum", "gradient", "monochrome", "vivid", "pale", "vibrant",
    "muted", "shrill", "sonorous", "muffled", "piercing", "blunt", "sharp",
    "serrated", "blunt", "keen", "dull", "astute", "obtuse", "acute", "chronic",
    "sporadic", "constant", "erratic", "predictable", "capricious", "steadfast",
    "volatile", "stable", "precarious", "secure", "tenuous", "resolute",
    "wavering", "conviction", "doubt", "certitude", "ambiguity", "lucid",
    "murky", "transparent", "opaque", "crystalline", "amorphous", "defined",
    "nebulous", "tangible", "abstract", "concrete", "theoretical", "applied",
    "raw", "refined", "primal", "civilized", "feral", "tame", "wild", "cultivated",
    "fallow", "harvest", "sow", "reap", "glean", "thresh", "winnow", "sift",
    "amalgam", "alloy", "pure", "base", "noble", "common", "rare", "abundant",
    "scarce", "copious", "meager", "lavish", "austere", "ornate", "spartan"
];

const NSFW_SEED_WORDS = [
    "arousal", "allure", "aphrodisiac", "amorous", "attraction", "abandon", "animalistic", "avarice", "adoration", "ass", "anal", "ahegao", "addiction", "arousing", "acrobatic", "affair", "afterglow", "aggressive", "alluring", "amplified", "analingus", "aphrodite", "asphyxiation", "autassassinophilia", "autofellatio",
    "blowjob", "bondage", "breasts", "bukkake", "bisexual", "bdsm", "buttplug", "babe", "bareback", "booty", "brat", "breed", "brunette", "busty", "bitch", "bare",  "boobs", "beast", "bang", "bath", "bedroom", "blonde", "buxom", "butt", "blow", "bounce", "bubble", "bust", "bra", "bound", "BDSM", "belly", "bimbo", "bisexual", "biting", "breeding","butt", 
    "caress", "carnal", "climax", "clitoris", "coitus", "cum", "cumflation", "come", "copulate", "corset", "coupling", "crotch", "cuddle", "cunnilingus", "curvaceous", "cute", "carnality", "carousing", "cavort", "chastity", "choke", "cleavage", "climactic", "clit", "clitoral", "coital", "come-hither", "compulsion", "concupiscence", "conquest", "consummate", "corrupt", "CBT", "choking", "cock", "cunt", "coitus", "collar", "consent", "corset",
    "desire", "deviant", "dominance", "dirty", "dripping", "downblouse", "dildo", "deep", "delight", "devour", "daddy", "dungeon", "dalliance", "dance", "darling", "debauched", "decadent", "deflower", "delicate", "demanding", "demure", "depraved", "desperate", "devotion", "discipline", "discreet", "disrobe", "distraction", "docile", "doggy", "doll", "dominatrix", "double penetration", "dreamy", "drunk", "drugs",
    "erogenous", "explicit", "erotic", "exhibitionism", "edging", "excitement", "ecstasy", "embrace", "erection", "exhalation", "ejaculation", "exotic", "extasy", "exhilaration", "enthrallment", "exaltation", "effervescence", "euphoria", "excess", "expression", "envy", "eagerness", "envelop", "exuberant", "evocation", "enticement", "elation", "emission", "exsertion",
    "flirt", "fondle", "fuck", "flesh", "foreplay", "fucktoy", "fuckhole", "fuckbuddy", "frisk", "furry", "futanari", "fuckable", "fecund", "fellate", "felch", "fellation",  "filthy", "flog", "fleshlight", "flogging", "fornication", "foursome", "frisson", "fuckfest", "fuckathon", "fuckdoll", "fuckery", "fuckmachine", "fuckmeat",
    "gag", "gagging", "gangbang", "garter", "gay", "gaze", "geisha", "gel", "gender", "genderbend", "gender swa", "genital", "genitalia", "genitals", "giggle", "gimp", "girth", "glamour", "gland", "glans", "glisten", "gloryhole", "gobble", "god", "goddess", "gooey",
    "humping", "hung", "horny", "hot", "honey", "handjob", "hardcore", "hedonism", "heels", "hentai", "hickey", "hirsute", "ho", "homoerotic", "horny", "host", "hostess", "hotwife", "humping", "hungry", "hunt", "hustler", "hymen", "hypnosis",
    "intimate", "indecent", "infatuated", "intense", "insatiable", "illicit", "incest", "incubus", "irrumatio", "inflation",
    "JAV", "jism", "juicy", "jizz", "jackoff", "jiggle", "joint", "jolt", "joy", "jubilant", "juices", 
    "kama", "kink", "kinky", "kiss", "kneel", "knotted", 
    "labia", "lactate", "lascivious", "lesbian", "lecher", "lewd", "libido", "lick", "lust", 
    "maiden", "male", "manhood", "manual", "masochism", "masturbate", "mate", "mating", "musk",
    "nipple", "nympho", "naughty", "naked", "nubile", "needy", "nymph", "nipples", "narcotic", "nookie", "narcissist", "nippleplay", "nymphomaniac",
    "orgasm", "oral", "obscene", "obedience", "oiled", "orgy", "overstimulation", "obsession", "outrageous", "objectify", "overload", "oversized", "obedient", 
    "penetration", "porn", "pleasure", "passion", "panties", "pussy", "panting", "passion", "penetration", "penis", "perversion", "petting", "pheromones", "phallic", "piercing", "pink", "pleasure", "plump", "porn", "porno", "power dynamics", "predator", "prey", "primal", "promiscuous", "prostitute",  "provocative", "pulsing", "pumping", "punishment", "pure", "purring",
    "queer", "quim", "quickie",
    "raunchy", "ravish", "romp", "rut", "rapture", "randy", "risque", "rump", "ravage", "rapturous", "racy",
    "seductive", "sensual", "slave", "slick", "slutty", "smut", "snug", "spank", "spicy", "spread", "squeeze", "steamy", "sticky", "stimulate", "straddle", "strapon", "strip", "stroke", "submissive", "succulent", "suck", "sultry", "supple", "swallow", "swell", "swinging", "swollen", "small", "size difference",
    "taboo", "tangle", "taste", "tease", "tempt", "thrust", "tingle", "toy", "temptation","throbbing", "tight", "torment", "tryst", "tumescent",
    "unashamed", "uninhibited", "unravel", "urge",
    "velvet", "venom", "vibrate", "vice", "vixen", "voyeur",
    "wanton", "whip", "wet", "wild", "worship","whimper", "whore", "wlw",
    "yield", "yuri", "yaoi", "yearn"
];

const DEFAULT_OUTLINE_ENTRY = `Overview
Tags: Up to ten important content tags, separated by commas
Genre: Two or three major categories that best describe the story
Synopsis: (D+50)Outline the plot of the story. Address important characters by name.
Protagonist: The proper name of the protagonist. No parentheticals.
Supporting Characters:  List up to three characters mentioned in the synopsis. Names only, separated by commas. No parentheticals. If there aren't any obvious supporting characters, put 'N/A' here.

Character Template
Name: ...
Gender: ...
Appearance: (D+20)...
Personality: (D-10)...
Voice Pattern: (D-20)Direct description without metaphor, analogy, or examples.

World Info
World: A specific name. 'Earth', if it fits. Otherwise, pick a proper name.
Region: (D-20)A specific name, followed by a description. If the world is 'Earth', pick a real place. Otherwise, pick a proper name.
Location: (D-10)...
Time Period: A specific year or period. 'Modern Day', if it fits. Otherwise, pick a year or name.

Timeline
Background Events: (D+20)...
Opening Circumstances: (D)...

Style Guide
Writing Style: (D-10)...
Tone: (D-20)...
Themes: (D-20)...
Perspective: Default to 'Second-person'
Tense: Default to 'Present'

AI Instructions
Special Instructions: (D)Write a set of additional instructions for the AI that will write this story. Assume the AI already has basic directives for quality writing; these are specific instructions for writing this story well.
Word Bans: A short list of words overused by AI, like 'ozone' 
Trope Bans: Start each with 'no'`

const DEFAULT_OUTLINE_NOTES = `🌍 Overview
>The generator uses the outline as a template. It follows the outline, creating each section and field listed, using the instructions provided for each field to generate their entries.

📋 Expected Structure
> The outline expects three types of text arranged like this:
    Section
    Field: Instructions
    Field: Instructions

    Section
    Field: Instructions
    Field: Instructions
> Sections categorize the fields that follow them. They are in title case, have two linebreaks between them and the last field, and they are followed by fields. They cannot use colons (":").
> Fields are the topics which contain instructions for the AI. Fields follow sections and end with a colon.
> Instructions let the AI know any specific rules about how it should produce entries for their field. They are all of the text after a field's colon and before the end of the line.

🧍 Character Template
> The Character Template is a special section of the outline.
> It is used to create Protagonist and supporting character sections within the scenario.
> Supporting characters are determined by the Supporting Characters field of the Overview
> DO NOT change the Character Template section name.

⚗️ Changing the Outline
> Feel free to change around the outline to get the generator to make a prompt that is more to your liking. 
> Fields, sections, and instructions can be added, removed, or changed, so long as they follow the expected structure.
> WARNING: Changing fields and sections above the generator's current position in the outline won't cause it to go back and generate the missing fields.
> For best effect, only change or add text below the generator's current position.

🎊 Special Instructions
> Special notation may optionally be used for Instructions.
> Instructions of "..." means the AI won't be given any special instructions for filling out a field. The AI is pretty clever, and it usually does a pretty good job without special instructions.
> "(D)" at the start of instructions tells the AI to write a description and gives it a word count target. By default, the base word count target is 50. The base value can be changed in the config card, but each field's description size can also be modified individually. To do this, put +/- and a number after the D.
> For example, with default settings, instructions of "(D-20)..." tells the AI to write a 30-word description, and gives it no further instructions on what that description should contain.`;

const SETTINGS_NOTES = `Change settings by adjusting numbers or changing "true" and "false". Do not change the card in any other way. Below are detailed explanations of each setting.

General Settings
> Description Size
 - (number, 10+)
 - The base number of words the AI will try to output for descriptive fields.
 - These fields are marked with a (D) in the Outline story card.
 - Large numbers here will require larger context sizes to work.

> Include Story Request in JSON
- (true or false)
- Includes the player's initial Story Request in the final JSON output.
- It will be placed as a field at the top of the Overview section.
- Only works if the player entered a story request on initial scenario creation.

Seed Word Settings
> Add Random Seed Words
- (true or false)
- If enabled, a list of random seed words will be added to the prompt.
- New seeds are generated every action.
- This is meant to add variety to the AI's generations
- Seed words are randomly selected from the enabled word lists.
- Seed words are not shown to the player by default.
- WARNING: retry behavior is unpredictable.
- AI dungeon caches multiple outputs at once to let you retry more quickly.
- Cached retries all share the same seed word list.

> Use SFW List
- (true or false)
- Whether the SFW word list should be included in the seed word pool.
- If all lists are set false, this list will be used.

> Use NSFW List
- (true or false)
- Whether the SFW word list should be included in the seed word pool.

> Seed Word Count
- (number, 1-50)
- How many seed words will be selected for the seed word list.

> Show Seed Words
- (true or false)
- If enabled, the seed words will be shown to the player.
- The seed words will be show on a comment line (starting with "//")
- These lines are hidden from the AI and ecluded from the final JSON`;
const HELP_TEXT = `🏭 Scenario Generator v2.0 Operation Manual 🏭

⚙️ Recommended Model Settings
> Model: DeepSeek 3.2
> Context Length: 3000+ (Gameplay -> Story Generator -> Memory System)
> Response Length: 200 (Gameplay -> Story Generator -> Model Settings)
> Raw Model Output: On (Gameplay -> Testing & Feedback)

✅ Normal Operation
> Scenario Generator begins by creating an Overview section based on the story request, prompts, and policies entered by the player on scenario creation.
> The player is only ever required to press "Continue" for the generator to complete the requested prompt. Typically it will require 7 or more conntinues (depending on the number of supporting characters).
> The generator guides the AI through the outline laid out in the Outline story card, attempting to get it to create one section per output until the outline is completed.
> The Character Template in the Outline is used for the Protagonist, and any supporting characters.
> Multiple outputs may be required for each section, particularly if the Description Size setting has been increased or the player is not using recomended settings.
> When the outline is complete, the next output will be a JSON-formatted prompt that can be copied and pasted into the paired Play scenario or used elsewhere.

📋 Expected Structure
> The generator expects three types of text arranged like this:
    Section
    Field: Entry
    Field: Entry

    Section
    Field: Entry
    Field: Entry
> Sections categorize the fields that follow them. They are in title case, have two linebreaks between them and the last field, and they are followed by fields. They cannot use colons (":").
> Fields are the topics about which entries provide information. Fields follow sections and end with a colon.
> Entries contain information about their field. They are all of the text after a field's colon and before the end of the line. 

⚗️ Modifying the Text
> The text as it appears in the scenario can be modified, but there are some circumstances where doing so to the wrong portion of text may cause with generation.
> Entries can be freely modified within the text of the scenario. The only time this may cause issues is if the Supporting Characters field in the Overview is modified while the generator is in the middle of creating the supporting characters.
> Fields and Sections should not be modified directly in the scenario text unless the outline is also modified to have the same sections and fields. It is safest to modify sections and fields through the outline, and allow the AI to generate them.

⏩ Continuing Partial Entries
> The generator can continue partially complete entries.
> It determines if it should start on a new field or continue the current entry based on line breaks, which it places after entries it considers complete.
> To get the AI to continue an entry, remove all trailing line breaks. Make sure the cursor ends where you want the AI to continue.

🌐 Modifying the Outline
> The Outline the generator follows is stored as a story card.
> This story card may be modified to change how the generator proceeds.
> For more information, check the Notes section of the Outline story card.

🔧 Modifying Configuration Settings
> The generator can be reconfigured through the Generator Configuration story card.
> Settings include: Description Length, Story Request Inclusion, and several Random Seed Word settings.
> For more information, check the Notes section of the Configuration story card.

⛔ Erase After Reading ⛔`;
