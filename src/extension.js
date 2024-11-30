"use strict";
import { isProbablyReaderable, Readability } from '@mozilla/readability';

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
        const userEmail = gmail.get.user_email();
        console.log("Hello, " + userEmail + ". This is your extension talking!");

        generateSummary("test test test test test")

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



function canBeParsed(document) {
  return isProbablyReaderable(document, {
    minContentLength: 100
  });
}

function parse(document) {
  if (!canBeParsed(document)) {
    return false;
  }
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();
  return article.textContent;
}

// Whenever the content in 'pageContent' changes then this is called to summarize it
// Therefore if we change pageContent somewhere it will automatically update
// Uses showSummary to push it into the box
chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.inGmail) {
      const inGmail = changes.inGmail.newValue;
      if (!inGmail) {
        showSummary("Cannot Summarize When Not In Gmail");
        console.log("not in gmail")
        return;
      }
    }
  
    if (changes.pageContent) {
      const pageContent = changes.pageContent.newValue;
      onContentChange(pageContent);
    }
  });
  
  async function onContentChange(newContent) {
    if (pageContent == newContent) {
      // no new content, do nothing
      return;
    }
    // startExtension(window._gmailjs)
    pageContent = newContent;
    let summary;
    if (newContent) {
      if (newContent.length > MAX_MODEL_CHARS) {
        updateWarning(
          `Text is too long for summarization with ${newContent.length} characters (maximum supported content length is ~4000 characters).`
        );
      } else {
        updateWarning('');
      }
      showSummary('Loading...');
      summary = await generateSummary(newContent);
    } else {
      summary = "There's nothing to summarize";
    }
    showSummary(summary);
  }
  
  async function generateSummary(text) {
    try {
      const session = await createSummarizer(
        {
          type: "tl;dr",
          format: "plain-text",
          length: "short"
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
    console.log(text)
    // summaryElement.innerHTML = DOMPurify.sanitize(marked.parse(text));
  }
  
  async function updateWarning(warning) {
    warningElement.textContent = warning;
    if (warning) {
      warningElement.removeAttribute('hidden');
    } else {
      warningElement.setAttribute('hidden', '');
    }
  }

parse(window.document);

