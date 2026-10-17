$content = [System.IO.File]::ReadAllText("src/App.tsx")
$start = $content.IndexOf([char]10 + "  [" + [char]34 + "Build an Accessible Modal")
if ($start -ge 0) {
    $end = $content.IndexOf("]" + [char]10 + [char]10 + "function CandidatePractice", $start)
    if ($end -ge 0) {
        $newContent = $content.Substring(0, $start) + $content.Substring($end + 1)
        [System.IO.File]::WriteAllText("src/App.tsx", $newContent)
        "Removed from $start to $end"
    } else {
        "End not found: $end"
    }
} else {
    "Start not found"
}