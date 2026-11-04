# Interface and story fonts

Inter, Roboto, Outfit and Nunito are self-hosted variable WOFF2 fonts from
[Google Fonts](https://fonts.google.com/). The corresponding SIL Open Font
License files are included in this directory. Original font sources and licenses:

- [Inter](https://github.com/google/fonts/tree/main/ofl/inter)
- [Roboto](https://github.com/google/fonts/tree/main/ofl/roboto)
- [Outfit](https://github.com/google/fonts/tree/main/ofl/outfit)
- [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito)

Files retain the original glyph subsets and contain content hashes in their
names. `app/fonts.css` registers unicode ranges so browsers download only the
ranges used by the page. No Google Fonts request is made by the client.
