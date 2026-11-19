// Single place for official channels and a future KakaoTalk button.
// A channel with an empty url is hidden. If every url is empty, the whole section stays hidden.
// kakaoJsKey: paste a Kakao JavaScript key to show the dedicated KakaoTalk button.
// Leave it empty to keep that button hidden. The phone share sheet can still offer KakaoTalk.
window.VR_CONFIG = {
  channels: [
    { id: "x", label: "X", url: "" },
    { id: "youtube", label: "YouTube", url: "" },
    { id: "discord", label: "Discord", url: "" },
  ],
  kakaoJsKey: "",
  // Optional absolute origin for shared links. Empty uses the current site.
  publicOrigin: "",
  // Optional ranking API origin. Empty uses this same site.
  apiBase: "",
};
