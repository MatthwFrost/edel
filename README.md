# Highlight text to listen
Listen to text on a website by selecting, right click and click listen.


# Very slow at the moment. Need to speed up.
Copying the array buffer is slow.

Is it though? It might just be the fetching?

# 0.0.2

#### Added:

Stoping the source instead of reloading the website.
Added a wait cursor when the audio is loading.
Add a save to notes feature. I think ill store on users local storage, and create a simple UI. Maybe one day move it to AWS. Could be good for learning languages.


### Current task 
Prefetching audio now. But only doing it when the audio comes to an end. Maybe create a webworker to do this in the background?
GPT IS SO GOOD

#### TODO:
- Read out Reddit posts | FEATURE
- Highlight paragraphs with a selection tool? | FEATURE
- Create indiviual usernames. | FEATURE
- Change voice, Could try. | FEATURE
- Change speed, Pitch is too high for playbackRate | FEATURE
- Stop context menu doesn't work | BUG
- Previous audio doesn't stop playing when new one starts REPLAY CENTRE | BUG 
- PROGRAM IS TOO SLOW | BUG
- Audio won't play if its not a sentence or longer | BUG

#### Fixed:
Cleaned up code
Audio being overwritten in S3.

### Tech stack

AWS:
 - DynamoDB.
 - S3 Bucket.
 - Gateway API.
 - Lamda Functions

Vanilla JS, HTML, CSS.
Chrome extensions


#### bin
Fix weird wikipedia issues. Delimeters? | BUG | SHOULD be fixed?


### Performance

Waiting for server response = 502ms
Download content = 3.90s <- BULK OF THE TIME

Ideas:
    - Prefetching <- How would that would? How would you get the selection?
    - Moving the fetch to a lamda function
    - Do I need to get all the text at once or am I limited to the server response time
