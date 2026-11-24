import "../../test/setup";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { ImageWithFallback } from "../image-with-fallback";

afterEach(() => {
  cleanup();
});

describe("ImageWithFallback", () => {
  it("shows an accessible fallback when the source is missing", () => {
    const { getByRole } = render(<ImageWithFallback alt="Site avatar" className="h-10 w-10" />);

    expect(getByRole("img", { name: "Site avatar" }).isConnected).toBe(true);
  });

  it("replaces a broken image with the fallback", () => {
    const { getByRole } = render(
      <ImageWithFallback
        src="https://example.com/broken.png"
        alt="Profile avatar"
        className="h-10 w-10"
      />,
    );

    fireEvent.error(getByRole("img", { name: "Profile avatar" }));

    expect(getByRole("img", { name: "Profile avatar" }).classList.contains("flex")).toBe(true);
  });

  it("renders an accessible monogram initial when fallbackText is provided and image fails", () => {
    const { getByRole, getByText } = render(
      <ImageWithFallback
        src="https://example.com/broken.png"
        alt="Zane7991"
        fallbackText="Zane7991"
        className="h-12 w-12"
      />,
    );

    fireEvent.error(getByRole("img", { name: "Zane7991" }));

    expect(getByText("Z").isConnected).toBe(true);
  });
});
