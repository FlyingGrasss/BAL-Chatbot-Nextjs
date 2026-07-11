import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="info-page-shell">
      <header className="info-page-header">
        <Link className="info-brand" href="/">
          <img src="/BAL_Logo.png" alt="Bornova Anadolu Lisesi logosu" />
          <span>BAL Asistan</span>
        </Link>
        <Link className="info-back" href="/">
          Sohbete dön
        </Link>
      </header>

      <article className="info-page">
        <p className="info-eyebrow">Proje Hakkında</p>
        <h1>BAL Asistan</h1>
        <p className="info-lead">
          Bornova Anadolu Lisesi hakkında bilgiye daha hızlı ve düzenli
          ulaşılabilmesi için hazırlanmış bağımsız bir öğrenci projesidir.
        </p>

        <section className="info-section">
          <h2>Bu proje ne yapar?</h2>
          <p>
            BAL Asistan; okulun akademik yapısı, kampüsü, gelenekleri, ulaşım
            bilgileri, sosyal yaşamı ve sık sorulan konular hakkında kısa,
            kaynak odaklı yanıtlar vermeyi amaçlar. Resmî bir okul sistemi
            değildir ve okul idaresi veya Millî Eğitim Bakanlığı adına işlem
            yapmaz.
          </p>
          <p>
            Yanıtlar bilgilendirme amaçlıdır. Kayıt, nakil, sınav, kontenjan,
            devamsızlık, burs, belge, disiplin ve benzeri konularda okulun
            resmî duyuruları, e-Okul, MEB ve okul idaresi esas alınmalıdır.
          </p>
        </section>

        <section className="info-section">
          <h2>Teknoloji</h2>
          <p>
            Proje kendi yapay zekâ modelini eğitmez. Yanıt üretiminde öncelikli
            olarak Gemini modelleri kullanılır; okul hakkında hazırlanan özel
            veri seti ve arama tabanlı kaynak sistemi, yanıtların BAL'a özgü
            bilgilerle desteklenmesini sağlar.
          </p>
          <p>
            Web sitesi Next.js ile geliştirilmiştir. Veri seti düzenli olarak
            güncellenebilir ve kaynak metninden yeniden indekslenebilir.
          </p>
        </section>

        <section className="info-section">
          <h2>Hazırlayanlar</h2>
          <p>
            Bu Websiteyi Hazırlayan: Emre Bozkurt&apos;28 - 10/C
            <br />
            Veri Hazırlamada Yardımcı: Burak Güldilek&apos;29 9/K
          </p>
        </section>

        <section className="info-section info-note">
          <h2>Önemli not</h2>
          <p>
            Yapay zekâ yanıtları eksik, hatalı veya güncel olmayan bilgiler
            içerebilir. Önemli kararlar almadan önce bilgi resmî kaynaklardan
            doğrulanmalıdır. Kişisel veya hassas bilgiler paylaşılmamalıdır.
          </p>
        </section>
      </article>

      <footer className="info-page-footer">
        Bu website Emre Bozkurt&apos;28 tarafından yapılmıştır.
      </footer>
    </main>
  );
}
