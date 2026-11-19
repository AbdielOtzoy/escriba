# Escriba privacy policy

_Last updated: November 17, 2026_

Escriba is a browser extension that writes a text transcript of your Google Meet calls
from the captions Meet shows. This page explains what it does with your data.

**In short: everything stays on your computer. Escriba sends nothing to anyone, including
its developer.**

## What Escriba reads

While you are in a call at `meet.google.com`, Escriba reads the captions Meet displays:
the name of each speaker and what they said. It also reads the meeting title, the time
and the caption language. It does not record audio or video, and it does not read the
meeting chat.

## Where it is stored

When the call ends, the transcript is saved in two places, both on your computer:

- as a Markdown file in your Downloads folder, under `transcripciones-meet/`;
- in the extension's local browser storage, so you can find it in the icon menu and on
  the transcripts page.

While a call is in progress, Escriba keeps a backup copy in the same browser storage so
the transcript is not lost if the browser closes. Escriba also stores your two settings
there.

You can delete any transcript from the transcripts page. Removing the extension deletes
its browser storage; the files in your Downloads folder stay until you delete them.

## What is shared

Nothing. Escriba makes no network requests, has no analytics, no ads and no accounts, and
loads no remote code. Its developer never receives your transcripts or any information
about how you use it.

The text leaves your computer only if you take it out: by copying a transcript, by
sharing the file, or by pasting the anonymous page outline from the "Not transcribing?"
button into a bug report. That outline contains the structure of the Meet page (tags,
roles, icon names) and no names, text or meeting codes.

## Permissions

| Permission                    | Why                                              |
| ----------------------------- | ------------------------------------------------ |
| Access to `meet.google.com`   | Read the captions during a call                  |
| `downloads`                   | Save each transcript as a file                   |
| `storage`, `unlimitedStorage` | Keep the transcripts and settings in the browser |
| `notifications`               | Warn you when transcription stops                |

## Other people in the call

The transcript contains what other participants said. You are responsible for telling
them that you are transcribing the call and for following the laws and rules that apply
to you.

## Changes

If this policy changes, the new version will be published on this page with a new date.
The source code is public at <https://github.com/AbdielOtzoy/escriba>.

## Contact

Open an issue at <https://github.com/AbdielOtzoy/escriba/issues>.
