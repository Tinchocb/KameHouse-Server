package main

import (
	"fmt"
	"kamehouse/internal/library/scanner"
)

func main() {
	title := "Dragon Ball Z Kai"
	resId, isMovie, found := scanner.ResolveDragonBallID(title)
	fmt.Printf("Title: %s -> resId: %d, isMovie: %t, found: %t\n", title, resId, isMovie, found)
	
	title = "Dragon Ball Z"
	resId, isMovie, found = scanner.ResolveDragonBallID(title)
	fmt.Printf("Title: %s -> resId: %d, isMovie: %t, found: %t\n", title, resId, isMovie, found)
	
	title = "Dragon Ball Z Kai - S01E01.mkv"
	resId, isMovie, found = scanner.ResolveDragonBallID(title)
	fmt.Printf("Title: %s -> resId: %d, isMovie: %t, found: %t\n", title, resId, isMovie, found)
}
