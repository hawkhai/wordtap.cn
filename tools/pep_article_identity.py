"""Keep published lesson URLs stable when reviewed candidates are removed/split."""

def source_key(lesson):
    source = lesson['source']
    return (lesson['groupId'], source['pdfMd5'], source['pageStart'],
            source['pageEnd'], source.get('manualReview', {}).get('splitIndex', 0))


def assign_published_identities(lessons, entries, group_id):
    expected = [entry for entry in entries if entry['groupId'] == group_id]
    if not expected:
        raise ValueError(f'{group_id}: no published identity inventory; register new articles explicitly')
    by_source = {}
    ids = set()
    for entry in expected:
        key = source_key(entry)
        if key in by_source or entry['id'] in ids:
            raise ValueError(f'{group_id}: duplicate published identity')
        by_source[key] = entry
        ids.add(entry['id'])
    seen = set()
    assignments = []
    for lesson in lessons:
        key = source_key(lesson)
        if key not in by_source or key in seen:
            raise ValueError(f'{group_id}: unknown or duplicate source identity: {key}')
        seen.add(key)
        assignments.append((lesson, by_source[key]))
    if seen != set(by_source):
        raise ValueError(f'{group_id}: generated articles missing from published inventory')
    # Validate the whole book before changing any identifiers.
    for lesson, entry in assignments:
        for field in ('id', 'sequenceNo', 'jsonPath'):
            lesson[field] = entry[field]
