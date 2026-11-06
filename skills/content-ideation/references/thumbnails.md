# Thumbnails

Packaging v1 includes a thumbnail **concept** and a rough HTML **mockup**,
never a generated image. The mockup exists to check one thing early: will a
stranger in the niche understand it at a glance, and does it make the same
promise as the title? Research notes behind these principles were gathered
in November 2026; the sources are listed at the end. Evidence is uneven:
YouTube's own guidance is firm, studies of faces and text disagree, and
B2B-specific advice is mostly rules of thumb.

## Principles

1. **Title and thumbnail make one promise.** The thumbnail adds what the
   title leaves out; it never repeats it. And the video's opening must keep
   that promise, or viewers leave (and YouTube now removes clickbait that
   the video doesn't deliver).
2. **One focal point.** One face, one number, or one comparison. Clutter
   is the most common reason a thumbnail fails at small size.
3. **Few words: 2–4.** No study fixes an exact number, but most strong
   thumbnails use none or a handful. The words must read at small size.
4. **A face is optional; if there is one, it shows a clear, calm emotion.**
   Large studies disagree on whether faces help, and one found faces did
   *worse* for business channels. Calm, credible expressions beat
   exaggerated ones in YouTube's own A/B tests of big channels. For a
   professional audience, an over-the-top "YouTube face" reads as
   unprofessional.
5. **Proof beats shock for professional buyers.** One big number, a cropped
   real screen, a before/after, or an A-versus-B comparison. Show the
   outcome, not the features.
6. **High contrast, and readable small.** Thumbnails show as small as about
   160–215 px wide (desktop sidebar, TV rows, end screens). Shrink the
   design to that size and check that the subject and every word still read.
7. **The niche's own word is a filter, not jargon.** A word the buyers use
   every day ("tip pool", "intake") tells the right viewer "this is for
   me". A term only insiders of your company use doesn't.
8. **Stay consistent across the channel**: similar colours and layout help
   returning viewers recognise you.
9. **Test, but expect small channels to get "inconclusive".** YouTube's
   Test & compare picks a winner by watch time, not clicks. Make variants
   really different. Refresh thumbnails on older videos too.

## Checklist for every mockup

- [ ] One focal point.
- [ ] A speaker placeholder labelled with the emotion wanted ("surprised",
      "skeptical", "pointing at the number"), or a reason there's no face.
- [ ] Thumbnail text is 2–4 words and shares no phrase of 2 or more
      consecutive words with the title.
- [ ] One visual element: a number, two things compared, or a screen.
- [ ] High contrast between text and background.
- [ ] Reads at the small size (168×94 in the mockup).
- [ ] Together with the title, it raises one question only the video answers.
- [ ] The video's first line keeps the thumbnail's promise.

## The mockup

Copy `templates/thumbnails.html` and add one `section.thumb` per picked
idea, with `id` = the idea's id, so a plan can link `thumbnails.html#8`. For
a kept idea, copy its section into `thumbnail.html` in the video folder.
Specs to keep in mind for the real thumbnail later: 16:9, at least
1280×720 (YouTube recommends uploading larger), JPG or PNG.

## LinkedIn

LinkedIn lets you upload a cover for native video, but there is no
published data on whether covers change views, and feed videos autoplay
muted, so the cover matters less there. Treat any LinkedIn cover advice as
a guess; reuse the YouTube thumbnail until you have your own results.

## Sources

- YouTube Help: Add video thumbnails; Thumbnail and title tips; Test & compare; Impressions and click-through rate (support.google.com/youtube, answers 72431, 12340300, 13861714, 9314486).
- YouTube's interview with Chucky Appleby (MrBeast's thumbnail lead), via Social Media Today, March 2024.
- vidIQ research: 500 breakout thumbnails (2026).
- 1of10 study of 300k+ videos on faces, via Search Engine Journal (2025).
- Reports on MrBeast's Test & compare results (closed-mouth faces won) and the leaked production guide (Tubefilter, 2024).
- Veritasium, "Clickbait is Unreasonably Effective" (2021).
- YouTube's clickbait enforcement (TechCrunch, December 2024).
- TechSmith on thumbnail sizes; VaynerMedia and Sked Social on LinkedIn video covers.
