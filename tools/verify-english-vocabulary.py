from english_vocabulary import PUBLIC, SOURCE, artifacts, encoded, known_issues

if __name__ == "__main__":
    outputs = artifacts()
    actual = {path.relative_to(PUBLIC).as_posix() for path in PUBLIC.rglob("*.json")}
    assert actual == set(outputs), "Missing or stale generated files"
    for relative, expected in outputs.items():
        assert (PUBLIC / relative).read_bytes() == encoded(expected), f"Generated data differs: {relative}"
    assert (PUBLIC / "LICENSE.txt").read_bytes() == (SOURCE / "LICENSE").read_bytes()
    for issue in known_issues():
        print(f"KNOWN SOURCE ISSUE (preserved): {issue['book']}:{issue['line']}{issue['field']} ({issue['word']})")
    print(f"Verified all {len(outputs)} JSON files against pinned sources; deterministic output and full coverage")
