"use strict";
// import { isProbablyReaderable, Readability } from '@mozilla/readability';

const boxStyle = `
.box {
            display: flex; /* Use flexbox for alignment */
            justify-content: center; /* Center horizontally */
            align-items: center; /* Center vertically */
            position: relative;
            transform-style: preserve-3d;
            border-radius: 8px;
            margin: 20px auto; /* Center the div with some space around */
            padding: 20px; /* Add space inside the div */
            width: 80%; /* Adjust the width to leave room on the sides */
            // font-family: Arial, sans-serif; /* Set an easy-to-read font */
            font-size: 16px; /* Make the text legible */
            line-height: 1.6; /* Improve readability with line spacing */
            // color: #333; /* Set a neutral text color */
            background-color: #ffffff; /* Add a light background for contrast */
            border: 1px solid #ddd; /* Subtle border to define the div */
            border-radius: 8px; /* Soften the edges */
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Add a slight shadow for depth */
          }

          .box::before {
            content: "";
            position: absolute; 
            inset: -2px;
            background: linear-gradient(
              180deg , 
              #00FFFF, /* Bright cyan at the top */
              #00E5FF, 
              #00CCFF
              /* Dark cyan at the bottom */
            );
            filter: blur(7px);
            transform: translate3d(0px,0px,-1px);
            border-radius: inherit;
            pointer-events: none;
          }
`

const spinner = `
<style>
  body {
    margin: 0; /* Remove default margin */
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh; /* Full viewport height */
    background: #f0f0f0; /* Light background for contrast */
    overflow: hidden; /* Prevent scrolling during animation */
  }

  #l4 {
    position: absolute; /* Use absolute positioning for precise control */
    width: 20px; /* Fixed width */
    height: 20px; /* Fixed height */
    background: #1EE5CF; /* Main color */
    border-radius: 15%; /* Slightly round the corners */
    box-shadow: 0px 0px 60px 15px #1EE5CF; /* Glowing trail */
    transform: translateX(-80px); /* Start position */
    clip-path: inset(0); /* Ensure full visibility at start */
    animation:
      l4-1 1s ease-in-out infinite alternate,
      l4-2 2s ease-in-out infinite;
  }

  @keyframes l4-1 {
    100% {
      transform: translateX(80px); /* Move horizontally */
    }
  }

  @keyframes l4-2 {
    33% {
      clip-path: inset(0 0 0 -100px); /* Adjust clipping */
    }
    50% {
      clip-path: inset(0 0 0 0); /* Full visibility */
    }
    83% {
      clip-path: inset(0 -100px 0 0); /* Adjust clipping */
    }
  }
</style>

<div id="l4"></div>

`;


// loader-code: wait until gmailjs has finished loading, before triggering actual extensiode-code.
const loaderId = setInterval(() => {
    if (!window._gmailjs) {
        return;
    }

    clearInterval(loaderId);
    startExtension(window._gmailjs);
}, 100);

// actual extension-code
function startExtension(gmail) {
    console.log("Extension loading...");
    window.gmail = gmail;

    gmail.observe.on("load", () => {
        var div = document.getElementById(':1')
        div.insertAdjacentHTML(
          "afterbegin",
          `
          <style>
          ${boxStyle}
          .spinner-container {
            display: flex; /* Ensure the spinner container uses flexbox */
            justify-content: center; /* Center horizontally */
            align-items: center; /* Center vertically */
            width: 100%;
            height: 100%; /* Take the full height of the box */
            position: relative;
          }

          </style>
          <div id="summary" class="box">
            <div class="spinner-container">
              ${spinner}
            </div>
          </div>`
        );
        
      
        const userEmail = gmail.get.user_email();
        console.log("Hello, " + userEmail + ". This is your extension talking!");
        console.log("Unread Inbox Emails: " + gmail.get.unread_inbox_emails());
        var messagesOnscreen = gmail.dom.visible_messages();

        // summarizeInbox("This is a block of text used to test if the summary functionality is working.")

        var inboxContent = [];

        for (const [key, value] of Object.entries(messagesOnscreen)){
          // console.log(value["summary"]);
          var TID = value["thread_id"];
          // console.log(gmail.new.get.thread_data(TID));

          var threadContent = gmail.new.get.thread_data(TID);
          console.log(threadContent["emails"][threadContent["emails"].length - 1]);
          var htmlContent = threadContent["emails"][threadContent["emails"].length - 1]["content_html"];

          // Create a new div element
          var tempDivElement = document.createElement("div");

          // Set the HTML content with the given value
          tempDivElement.innerHTML = htmlContent;

          // Retrieve the text property of the element 
          var rawText = tempDivElement.textContent || tempDivElement.innerText || "";
          rawText = rawText.trim()

          var cleanedText = rawText.replace(/(\n\s*){2,}/g, '\n\n');
          cleanedText = capText(cleanedText, 3750);
          cleanedText = "You have an email from " + threadContent["emails"][threadContent["emails"].length - 1]["from"]["name"] +" that reads: \n"+ cleanedText;
          // console.log(cleanedText);

          inboxContent.push(cleanedText);
          
          // console.log(cleanedText);
        }
        summarizeInbox(inboxContent);

        console.log(gmail.dom.visible_messages())

        gmail.observe.on("view_email", (domEmail) => {
            console.log("Looking at email:", domEmail);
            const emailData = gmail.new.get.email_data(domEmail);
            console.log("Email data:", emailData);
        });

        gmail.observe.on("compose", (compose) => {
            console.log("New compose window is opened!", compose);
        });
    });
}

function capText(text, maxLength){
  if (text.length > maxLength){
    return text.slice(0,maxLength);
  } else {
    return text;
  }
}

async function summarizeInbox(inboxContent){
  // console.log(inboxContent)
  var toSummarize = "";
  for (let text of inboxContent){
    text = await generateSummary(text);
    toSummarize = toSummarize + text + "\n";
  }
  toSummarize = capText(toSummarize, 2000);
  console.log(toSummarize);
  const summary = await generateSummary(toSummarize);
  showSummary(summary);
}

async function generateSummary(text) {
  try {
    const session = await createSummarizer(
      {
        type: "tl;dr",
        format: "plain-text",
        length: "long"
      },
      (message, progress) => {
        console.log(`${message} (${progress.loaded}/${progress.total})`);
      }
    );
    const summary = await session.summarize(text);
    session.destroy();
    return summary;
  } catch (e) {
    console.log('Summary generation failed');
    console.error(e);
    return 'Error: ' + e.message;
  }
}

async function createSummarizer(config, downloadProgressCallback) {
  if (!window.ai || !window.ai.summarizer) {
    throw new Error('AI Summarization is not supported in this browser');
  }
  const canSummarize = await window.ai.summarizer.capabilities();
  if (canSummarize.available === 'no') {
    throw new Error('AI Summarization is not supported');
  }
  const summarizationSession = await self.ai.summarizer.create(
    config,
    downloadProgressCallback
  );
  if (canSummarize.available === 'after-download') {
    summarizationSession.addEventListener(
      'downloadprogress',
      downloadProgressCallback
    );
    await summarizationSession.ready;
  }
  return summarizationSession;
}

// The summary text is then put inside of the innerHTML portion of the summary element
async function showSummary(text) {
  var div = document.getElementById('summary');
  div.innerHTML = `
    <style>
    ${boxStyle}
    </style>
    <div id="typingTarget"></div>
  `;

  const typingTarget = document.getElementById('typingTarget');
  typingTarget.innerHTML = ''; // Clear existing content

  for (let i = 0; i < text.length; i++) {
    typingTarget.innerHTML += text[i];
    await new Promise(resolve => setTimeout(resolve, 15)); // Adjust typing speed (50ms per character)
  }

  console.log(text);
}
