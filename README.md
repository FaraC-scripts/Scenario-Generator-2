# Scenario Generator v2.0

# 🏭 Scenario Generator v2.0 Operation Manual 🏭

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
    // empty line
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


# Outline Story Card Notes

🌍 Overview
>The generator uses the outline as a template. It follows the outline, creating each section and field listed, using the instructions provided for each field to generate their entries.

📋 Expected Structure
> The outline expects three types of text arranged like this:
    Section
    Field: Instructions
    Field: Instructions
    // empty line
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
> For example, with default settings, instructions of "(D-20)..." tells the AI to write a 30-word description, and gives it no further instructions on what that description should contain.


# Generator Configuration Story Card Notes

Change settings by adjusting numbers or changing "true" and "false". Do not change the card in any other way. Below are detailed explanations of each setting.

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
- These lines are hidden from the AI and ecluded from the final JSON
