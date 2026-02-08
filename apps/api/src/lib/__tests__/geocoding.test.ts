import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocode } from "../geocoding";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("geocode", () => {
	it("returns coordinates for a valid address", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve([
					{
						lat: "35.0394875",
						lon: "135.7291553",
						display_name: "Kinkaku-ji, Kyoto",
					},
				]),
		});

		const result = await geocode("京都市北区金閣寺町1");

		expect(result).toEqual({ latitude: 35.0394875, longitude: 135.7291553 });
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("nominatim.openstreetmap.org"),
			expect.objectContaining({
				headers: expect.objectContaining({
					"User-Agent": expect.any(String),
				}),
			}),
		);
	});

	it("returns null when no results found", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]),
		});

		const result = await geocode("存在しない住所12345");
		expect(result).toBeNull();
	});

	it("returns null when fetch fails", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		const result = await geocode("京都市");
		expect(result).toBeNull();
	});

	it("returns null for empty address", async () => {
		const result = await geocode("");
		expect(result).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
