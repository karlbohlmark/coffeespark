curl -s -XGET http://nodejs.debuggable.com/2011-07-17.txt | grep substack | sed "s/[^:]*:[^ ]* \(.*\)/\1/"

