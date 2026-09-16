package parallel

import (
	"fmt"
	"testing"
	"time"

	"github.com/sourcegraph/conc/pool"
	"github.com/sourcegraph/conc/stream"
)

func fakeAPICall(id int) (int, error) {
	//time.Sleep(time.Millisecond * time.Duration(100+rand.Intn(500)))
	time.Sleep(time.Millisecond * 200)
	return id, nil
}

func TestEachTask(t *testing.T) {
	ids := []int{1, 2, 3, 4, 5}
	var count int
	EachTask(ids, func(item int, index int) {
		count += item
	})
}

func TestConc(t *testing.T) {

	ids := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30}

	fetch := func(ids []int) ([]int, error) {
		p := pool.NewWithResults[int]().WithErrors()
		for _, id := range ids {
			id := id
			p.Go(func() (int, error) {
				return fakeAPICall(id)
			})
		}
		return p.Wait()
	}

	res, _ := fetch(ids)

	for _, v := range res {
		t.Log(v)
	}

}

func TestConcStream(t *testing.T) {

	ids := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30}

	strm := stream.New()
	for _, id := range ids {
		id := id
		strm.Go(func() stream.Callback {
			res, err := fakeAPICall(id)
			// This will print in the order the tasks were submitted
			return func() {
				fmt.Println(res, err)
			}
		})
	}
	strm.Wait()

}
