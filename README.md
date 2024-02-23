# Edel v0.2 
Listen to text on a website by selecting, right click and click listen.

## Recent feature update
- Able to play audio by selecting it.
- Prefetching audio. Speed up the fetch by 63%

### Found errors
- Randomly stops.
- Speech is quite random.
- Starting speech is quite annoying. Maybe include a readaloud button on paragraphs.
- Doesn't work between pages.

#### TODO:
- Implement reddit support.
- Reddit play doesn't check for char limit.

#### LAZYTODO:
- Load test application.                                        | TEST
- Skipping some sentences? why?                                 | BUG
- Change speed, Pitch is too high for playbackRate              | FEATURE
- Show what text is being writen with highlight                 | FEATURE
- Read article posts UI element.                                | FEATURE
- Highlight paragraphs with a selection tool?                   | FEATURE
- Could be good to skip ahead by selecting text.                | FEATURE HARD
- Audio won't play if its not a sentence or longer              | BUG
- Stop context menu doesn't work Randomly                       | BUG <- Should be fixed this time. 

#### Fixed:
- IMPORTANT Better error UI.                                            | FEATURE
- Doesn't work on dynamically loaded pages                      | BUG <- Could be fixed by using a shortcut to start the selection.
- IMPORTANT Create indiviual usernames.                         | FEATURE
- Get rid of API Key                                                    | BUG
- IMPORTANT Change voice                                                | FEATURE
- Read out Reddit posts                                                 | FEATURE
- Add a DEBUG tag.                                                      | FEATURE
- Previous audio doesn't stop playing when new one starts REPLAY CENTRE | BUG 
- PROGRAM IS TOO SLOW                                                   | BUG <- Big new update feature.
- Cleaned up code                                                       | REFACTOR
- Audio being overwritten in S3.                                        | BUG
- First fetch = high stability, other fetches low variablity            | FEATURE


### Tech stack

AWS:
- DynamoDB.
- S3 Bucket.
- Gateway API.
- Lamda Functions
- Chrome extensions API

### Performance

OLD:
- Waiting for server response = 502ms
- Download content = 3.90s <- BULK OF THE TIME

NEW:
- Load < 2 secs for any text length. (Prefetching feature)

# What needs ready for release?
- Reliable. Lots of testing. What breaks the software. Needs to work everytime.
- Play audio quickly by a click of a button, be able to stop and start everytime.
- Clear error handling. Alerts and popup.
- AWS Roles stored.
- API gateways protected.
- Reddit support.
- GPT Support. <- Imagine its quite hard because of the dynamic content.


### Testing
- Try on different browser, and account.
- Constantly use. Try install at work.
