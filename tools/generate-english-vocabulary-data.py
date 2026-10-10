from english_vocabulary import PUBLIC, SOURCE, artifacts, write_json

if __name__ == "__main__":
    outputs = artifacts()
    for relative, value in outputs.items():
        write_json(PUBLIC / relative, value)
    (PUBLIC / "LICENSE.txt").write_bytes((SOURCE / "LICENSE").read_bytes())
    print(f"Generated {outputs['manifest.json']['totalLessons']} units / {outputs['manifest.json']['totalWords']} entries")
