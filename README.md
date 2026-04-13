<img width="1280" height="800" alt="3" src="https://github.com/user-attachments/assets/91ee9db7-4f53-43fe-b331-609486c397df" />
# Diff Checker

Chrome için **Manifest V3** tabanlı bir tarayıcı eklentisi. İki metni **satır satır** karşılaştırır; eklenen (`+`) ve silinen (`−`) satırları renkli özet alanında gösterir.

## Özellikler

- **Tam sayfa arayüz**: Araç çubuğu simgesine tıklanınca eklenti yeni sekmede açılır (popup yok).
- **Satır bazlı diff**: `diff-lines.js` ile birleştirilmiş satır farkı hesaplanır.
- **Farklar arasında gezinme**: Fark özeti başlığında ↑ / ↓ ile yalnızca değişen satırlar (eklenen/silinen) arasında dolaşma ve vurgulama.
- **Yeniden boyutlandırma**: Metin alanları ile fark özeti arasındaki **yatay ayraç**ı sürükleyerek üst ve alt bölüm yüksekliğini ayarlama.
- **Tam ekran**: Fark özeti çıktısının sağ altındaki düğme ile fark özetini tam ekran gösterme; tekrar tıklayarak veya `Esc` ile çıkma.
- **Özet kopyalama**: Diff metnini panoya kopyalama.

## Kurulum (geliştirici)

1. Bu depoyu klonlayın veya indirin.
2. Chrome’da `chrome://extensions` sayfasını açın.
3. Sağ üstten **Geliştirici modu**nu açın.
4. **Paketlenmemiş öğe yükle** ile bu proje klasörünü seçin.

## Kullanım

1. Araç çubuğundaki **Diff Checker** simgesine tıklayın; arayüz yeni sekmede açılır.
2. Sol (**A**) ve sağ (**B**) alanlara metinleri yapıştırın veya yazın.
3. **Karşılaştır** ile diff üretin.
4. İsterseniz ayraç ile yüksekliği, sağ alttaki ikon ile tam ekranı kullanın.

## Proje yapısı

| Dosya | Açıklama |
|--------|-----------|
| `manifest.json` | Eklenti bildirimi (MV3) |
| `background.js` | Simge tıklanınca `fullpage.html` sekmesi |
| `fullpage.html` | Ana arayüz |
| `popup.css` | Stiller |
| `popup.js` | Karşılaştırma, gezinme, splitter, tam ekran |
| `diff-lines.js` | Satır diff algoritması |
| `icons/` | Eklenti simgeleri |

## Gereksinimler

- Chromium tabanlı tarayıcı (Chrome, Edge, Brave vb.) — **Manifest V3** desteği.

## Lisans

[MIT License](LICENSE) — yazılımı özgürce kullanabilir, kopyalayabilir, değiştirebilir, birleştirebilir, yayınlayabilir, dağıtabilir veya satabilirsiniz; tek koşul telif ve izin metninin kopyalarını korumaktır.
