// Package fandomwiki – public interface for the Fandom Wiki client.
// Any package that needs wiki data should depend on this interface,
// not on the concrete *Client, to keep dependencies injectable.
package fandomwiki

// FandomWikiClient is the contract that the concrete Client implements.
// Depend on this interface in handlers and services to enable clean DI.
type FandomWikiClient interface {
	// Search performs a full-text search on the wiki and returns matching pages.
	Search(query string) ([]SearchResult, error)
	// GetDetails fetches the introductory summary and profile image for a page.
	GetDetails(title string) (*FandomEntry, error)
}

// Compile-time assertion: *Client must satisfy FandomWikiClient.
var _ FandomWikiClient = (*Client)(nil)
