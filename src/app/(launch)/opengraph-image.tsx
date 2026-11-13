import { ImageResponse } from "next/og";

export const alt = "BadmintonXP | The badminton community game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 76,
        color: "white",
        background: "#071b38",
        borderBottom: "22px solid #e9234c",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 38,
          fontWeight: 800,
          marginBottom: 38,
        }}
      >
        BADMINTON<span style={{ color: "#ff914c" }}>XP</span>
      </div>
      <div style={{ display: "flex", fontSize: 90, fontWeight: 900 }}>
        Predict. Quiz.
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 900,
          color: "#ff914c",
        }}
      >
        Earn XP for your country.
      </div>
      <div style={{ display: "flex", fontSize: 28, marginTop: 30 }}>
        The badminton community game
      </div>
    </div>,
    size,
  );
}
