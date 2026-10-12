/**
 * type="application/ld+json" bir veri bloğudur, tarayıcı onu çalıştırmaz ve
 * script-src kuralına takılmaz. Nonce eklersek tarayıcı özniteliği güvenlik
 * gereği DOM'dan siler, React de sunucudaki değerle karşılaştırıp hydration
 * uyuşmazlığı bildirir. Bu yüzden nonce bilerek verilmiyor.
 */
export function JsonLd({ data }: { data: unknown }) {
  // Kapanış etiketi kaçırılmazsa panelden girilen bir cevap script bloğunu bitirebilir.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
