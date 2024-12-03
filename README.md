# Scripture Burrito Handler

Main function - to enable separate handling of:

- editing text
- alignment
- formatting data
- footnotes and various comments

implemented as a VS Code Extension

## Strategy

Location based *(directory and filename)*

- As soon as any Scripture Burrito package is detected *(checking for a **./metadata.json** file)*, then a conversion process is started.

- A **"strip data conversion"** is run for each Bible book thereby separating all data from the USFM files into various files under an "uwj" subdirectory location

The ufw subdirectory serves as **"a data pool"** for another trigger, where any changes to the text *(pure text, completly stripped from any extra data)* are detected. Whenever such a change is detected, then a "merge data conversion" is run for that very Bible book, where these changes were found. This "merge" results in an updated and exported USFM file in the **./export** directory

## Helpful future improvement

Instead of importing Scripture Burrito packages with files in the USFM format, then it would be a lot more efficient and faster  to already have Scripture Burrito packages kept ready made in an already converted format *(through an already previously finished "strip data conversion")*

## Running this VS Code extension

- Run `npm install` in terminal to install dependencies
- Copy all content from the "test-data" directory to a directory where you want to run the tests
- Run the `Run Extension` target in the Debug View. This will:
  
  - Start a task `npm: watch` to compile the code
  - Run the extension in a new VS Code window
