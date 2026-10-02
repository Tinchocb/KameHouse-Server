package anime

func (e *Episode) GetProgressNumber() int {
	if e == nil {
		return -1
	}
	return e.ProgressNumber
}

func (e *Episode) IsMain() bool {
	if e == nil || e.LocalFile == nil {
		return false
	}
	return e.LocalFile.IsMain()
}
