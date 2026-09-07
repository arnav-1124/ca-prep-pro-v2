async function probePaper1() {
  console.log("Probing Paper 1 units from 87980 to 88015...");
  
  const testNames = [
    "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9", "ch10", "ch11",
    "ch1u1", "ch1u2", "ch1u3", "ch1u4", "ch1u5", "ch1u6", "ch1u7", "ch1u8",
    "ch2u1", "ch2u2", "ch2u3",
    "ch4u1", "ch4u2",
    "ch6u1", "ch6u2", "ch6u3",
    "ch7u1", "ch7u2", "ch7u3",
    "ch8u1", "ch8u2", "ch8u3", "ch8u4", "ch8u5",
    "ch9u1", "ch9u2",
    "ch10u1", "ch10u2",
    "ch11u1", "ch11u2", "ch11u3",
  ];

  for (let id = 87980; id <= 88014; id++) {
    for (const name of testNames) {
      const url = `https://resource.cdn.icai.org/${id}bos-aps2230-${name}.pdf`;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
          console.log(`[P1 FOUND] ${id} -> ${name} (${url})`);
          break;
        }
      } catch {}
    }
  }
}

probePaper1().then(() => process.exit(0));
