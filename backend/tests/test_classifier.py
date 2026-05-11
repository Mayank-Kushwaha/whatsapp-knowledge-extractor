"""Unit tests for the message classifier service."""

import pytest
from app.services.classifier import (
    classify_by_extension,
    classify_message,
    classify_url,
    extract_filename,
    extract_urls,
)


class TestClassifyUrl:
    def test_youtube(self):
        assert classify_url("https://www.youtube.com/watch?v=abc123") == "youtube"
        assert classify_url("https://youtu.be/abc123") == "youtube"
        assert classify_url("https://m.youtube.com/watch?v=abc123") == "youtube"

    def test_google_drive(self):
        assert classify_url("https://drive.google.com/file/d/abc") == "drive"
        assert classify_url("https://docs.google.com/document/d/abc") == "drive"
        assert classify_url("https://sheets.google.com/spreadsheets/d/abc") == "drive"

    def test_amazon(self):
        assert classify_url("https://www.amazon.com/dp/B09ABC") == "amazon"
        assert classify_url("https://www.amazon.in/dp/B09ABC") == "amazon"
        assert classify_url("https://amzn.to/3abc") == "amazon"

    def test_twitter(self):
        assert classify_url("https://twitter.com/user/status/123") == "twitter"
        assert classify_url("https://x.com/user/status/123") == "twitter"
        assert classify_url("https://t.co/abc123") == "twitter"

    def test_maps(self):
        assert classify_url("https://maps.google.com/maps?q=abc") == "maps"
        assert classify_url("https://maps.app.goo.gl/abc123") == "maps"

    def test_news(self):
        assert classify_url("https://www.bbc.com/news/article") == "news"
        assert classify_url("https://www.nytimes.com/2024/article") == "news"
        assert classify_url("https://ndtv.com/india-news/article") == "news"

    def test_generic(self):
        assert classify_url("https://github.com/user/repo") == "generic"
        assert classify_url("https://stackoverflow.com/questions/123") == "generic"
        assert classify_url("https://example.com") == "generic"


class TestClassifyByExtension:
    def test_images(self):
        assert classify_by_extension(".jpg") == "image"
        assert classify_by_extension(".png") == "image"
        assert classify_by_extension(".webp") == "image"
        assert classify_by_extension(".gif") == "image"

    def test_videos(self):
        assert classify_by_extension(".mp4") == "video"
        assert classify_by_extension(".mov") == "video"
        assert classify_by_extension(".avi") == "video"

    def test_audio(self):
        assert classify_by_extension(".mp3") == "audio"
        assert classify_by_extension(".ogg") == "audio"
        assert classify_by_extension(".opus") == "audio"

    def test_pdf(self):
        assert classify_by_extension(".pdf") == "pdf"

    def test_documents(self):
        assert classify_by_extension(".docx") == "document"
        assert classify_by_extension(".xlsx") == "document"
        assert classify_by_extension(".pptx") == "document"

    def test_contact(self):
        assert classify_by_extension(".vcf") == "contact"

    def test_unknown(self):
        assert classify_by_extension(".xyz") == "unknown_media"


class TestExtractUrls:
    def test_single_url(self):
        urls = extract_urls("Check this out https://example.com/page")
        assert urls == ["https://example.com/page"]

    def test_multiple_urls(self):
        urls = extract_urls("Link1: https://a.com Link2: http://b.com/page")
        assert len(urls) == 2
        assert "https://a.com" in urls
        assert "http://b.com/page" in urls

    def test_no_urls(self):
        assert extract_urls("Just a plain text message") == []

    def test_url_with_params(self):
        urls = extract_urls("https://youtube.com/watch?v=abc123&t=120")
        assert len(urls) == 1
        assert "abc123" in urls[0]


class TestExtractFilename:
    def test_file_attached(self):
        assert extract_filename("IMG-20240315-WA0001.jpg (file attached)") == "IMG-20240315-WA0001.jpg"

    def test_bare_filename(self):
        assert extract_filename("document.pdf") == "document.pdf"

    def test_no_filename(self):
        assert extract_filename("Hello, how are you?") is None

    def test_video_filename(self):
        assert extract_filename("VID-20240315-WA0001.mp4 (file attached)") == "VID-20240315-WA0001.mp4"


class TestClassifyMessage:
    def test_plain_text(self):
        result = classify_message("Hello, how are you?")
        assert result["type"] == "text"
        assert result["urls"] == []

    def test_link_generic(self):
        result = classify_message("Check out https://github.com/user/repo")
        assert result["type"] == "link"
        assert result["link_type"] == "generic"
        assert len(result["urls"]) == 1

    def test_youtube_link(self):
        result = classify_message("Watch this: https://www.youtube.com/watch?v=abc123")
        assert result["type"] == "video"
        assert result["link_type"] == "youtube"

    def test_image_file(self):
        result = classify_message("IMG-20240315-WA0001.jpg (file attached)")
        assert result["type"] == "image"
        assert result["filename"] == "IMG-20240315-WA0001.jpg"

    def test_pdf_file(self):
        result = classify_message("report.pdf (file attached)")
        assert result["type"] == "pdf"
        assert result["filename"] == "report.pdf"

    def test_audio_file(self):
        result = classify_message("PTT-20240315-WA0001.opus (file attached)")
        assert result["type"] == "audio"

    def test_document_file(self):
        result = classify_message("spreadsheet.xlsx (file attached)")
        assert result["type"] == "document"

    def test_contact_file(self):
        result = classify_message("John_Doe.vcf (file attached)")
        assert result["type"] == "contact"

    def test_location_maps_url(self):
        result = classify_message("Meeting here: https://maps.google.com/maps?q=28.6,77.2")
        assert result["type"] == "location"
        assert result["link_type"] == "maps"

    def test_location_text(self):
        result = classify_message("Location: Near Central Park")
        assert result["type"] == "location"

    def test_drive_link(self):
        result = classify_message("Here's the doc: https://docs.google.com/document/d/abc123")
        assert result["type"] == "link"
        assert result["link_type"] == "drive"

    def test_twitter_link(self):
        result = classify_message("See this tweet: https://twitter.com/user/status/123")
        assert result["type"] == "link"
        assert result["link_type"] == "twitter"

    def test_amazon_link(self):
        result = classify_message("Buy this: https://www.amazon.in/dp/B09ABC")
        assert result["type"] == "link"
        assert result["link_type"] == "amazon"

    def test_media_filename_param(self):
        result = classify_message("IMG-001.jpg", media_filename="IMG-001.jpg")
        assert result["type"] == "image"

    def test_video_file(self):
        result = classify_message("VID-20240315-WA0001.mp4 (file attached)")
        assert result["type"] == "video"
