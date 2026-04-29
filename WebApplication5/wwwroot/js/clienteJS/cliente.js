// ===== CLIENTE.JS — com validações completas (TCC) =====
// Depende de: /js/shared/flexValidation.js

const CLIENTES_POR_PAGINA = 10;
let paginaAtual = 1;
let clientesFiltrados = [];
let todosClientes = [];
let clienteEmEdicao = null;
let clienteParaDeletar = null;
let filtroStatus = "todos";
let filtroTexto = "";
let filtroTipo = "nome";

// ──────────────────────────────────────────
// PERMISSÕES DE CAMPOS
// ──────────────────────────────────────────
let permissoesCampos = null; // null = ainda não carregou
let isAdmin = false;

async function carregarPermissoesCampos() {
    try {
        const data = await apiGet('/Permissao/CamposCliente');
        isAdmin = data.admin;
        permissoesCampos = data.campos ?? [];
    } catch {
        // Se falhar, assume acesso total
        isAdmin = true;
        permissoesCampos = [];
    }
}

function getPermissaoCampo(chave) {
    if (isAdmin || !permissoesCampos)
        return { visivel: true, editavel: true };

    const p = permissoesCampos.find(c => c.chave === chave);
    if (!p) return { visivel: true, editavel: true };
    return { visivel: p.visivel, editavel: p.editavel };
}

function aplicarPermissoesCampos(prefixo) {
    if (isAdmin) return; // admin vê tudo, não precisa processar

    const mapeamento = [
        { chave: 'nome', ids: [`${prefixo}-nome`] },
        { chave: 'cpfCNPJ', ids: [`${prefixo}-doc`] },
        { chave: 'razaoSocial', ids: [`${prefixo}-razaosocial`] },
        { chave: 'genero', ids: [`${prefixo}-genero`] },
        { chave: 'dthNascimento', ids: [`${prefixo}-nascimento`] },
        { chave: 'email', ids: [`${prefixo}-email`] },
        { chave: 'telefone', ids: [`${prefixo}-telefone`] },
        { chave: 'logradouro', ids: [`${prefixo}-logradouro`] },
        { chave: 'numero', ids: [`${prefixo}-numero`] },
        { chave: 'complemento', ids: [`${prefixo}-complemento`] },
        { chave: 'bairro', ids: [`${prefixo}-bairro`] },
        { chave: 'cidade', ids: [`${prefixo}-cidade`] },
        { chave: 'estado', ids: [`${prefixo}-estado`] },
        { chave: 'cep', ids: [`${prefixo}-cep`] },
        { chave: 'tipoCliente_id', ids: [`${prefixo}-tipocliente`] },
        { chave: 'saldoDevedor', ids: [`${prefixo}-saldo`] },
        { chave: 'observacao', ids: [`${prefixo}-observacao`] },
    ];

    mapeamento.forEach(({ chave, ids }) => {
        const perm = getPermissaoCampo(chave);

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            const grupo = el.closest('.form-group');

            if (!perm.visivel) {
                // Oculta o grupo inteiro (label + input)
                if (grupo) grupo.style.display = 'none';
                return;
            }

            // Visível mas sem edição
            if (!perm.editavel) {
                el.setAttribute('readonly', true);
                el.style.background = '#f8fafc';
                el.style.color = '#9ca3af';
                el.style.cursor = 'default';

                // Select vira readonly visual
                if (el.tagName === 'SELECT') {
                    el.style.pointerEvents = 'none';
                    el.style.appearance = 'none';
                }

                // Adiciona badge de readonly no label
                const label = grupo?.querySelector('label');
                if (label && !label.querySelector('.readonly-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'readonly-badge';
                    badge.innerHTML = ' <i class="bi bi-lock-fill"></i>';
                    badge.style.cssText = `
                        font-size:1rem;color:#d97706;margin-left:.4rem;
                    `;
                    badge.title = 'Somente leitura';
                    label.appendChild(badge);
                }
            }
        });
    });
}

// Aplica nas colunas da tabela também
function aplicarPermissoesTabela() {
    if (isAdmin) return;

    const colunasMapa = {
        'cpfCNPJ': 4,  // índice da coluna na tabela (1-based)
        'email': 5,
        'telefone': 6,
        'saldoDevedor': 7,
    };

    Object.entries(colunasMapa).forEach(([chave, colIdx]) => {
        const perm = getPermissaoCampo(chave);
        if (!perm.visivel) {
            // Oculta header e cells dessa coluna
            const ths = document.querySelectorAll(
                `#tabela-clientes thead tr th:nth-child(${colIdx})`
            );
            const tds = document.querySelectorAll(
                `#tabela-clientes tbody tr td:nth-child(${colIdx})`
            );
            [...ths, ...tds].forEach(el => el.style.display = 'none');
        }
    });
}

async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json();
}

async function apiPost(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const texto = await res.text().catch(() => "");
        throw new Error(texto || `POST ${url} → ${res.status}`);
    }
    return res;
}

// ──────────────────────────────────────────
// CARREGAR E FILTRAR
// ──────────────────────────────────────────
async function carregarClientes() {
    try {
        const data = await apiGet("/Cliente/Listar");
        todosClientes = data.map(c => ({ ...c, fAtivo: c.fAtivo == 1 }));
        aplicarFiltros();
    } catch (err) {
        flexToast("Não foi possível carregar os clientes: " + err.message, "erro");
    }
}

function aplicarFiltros() {
    clientesFiltrados = todosClientes.filter(c => {
        const ativo = Boolean(c.fAtivo);
        if (filtroStatus === "ativo" && !ativo) return false;
        if (filtroStatus === "inativo" && ativo) return false;
        if (filtroTexto) {
            const campo = filtroTipo === "nome"
                ? (c.nome ?? "").toLowerCase()
                : (c.cpfCNPJ ?? "").replace(/\D/g, "");
            const termo = filtroTipo === "nome"
                ? filtroTexto.toLowerCase()
                : filtroTexto.replace(/\D/g, "");
            if (!campo.includes(termo)) return false;
        }
        return true;
    });
    paginaAtual = 1;
    renderizarTabela();
}

function filtrarTabela() {
    filtroTipo = document.getElementById("select-tipo-filtro").value;
    filtroTexto = document.getElementById("input-termo-busca").value.trim();
    aplicarFiltros();
}

function setFiltroStatus(valor) {
    filtroStatus = valor;
    document.querySelectorAll(".btn-status-filtro").forEach(btn =>
        btn.classList.remove("ativo-sel", "ativo-on", "ativo-off"));
    const mapa = { todos: "ativo-sel", ativo: "ativo-on", inativo: "ativo-off" };
    document.getElementById(`btn-filtro-${valor}`).classList.add(mapa[valor]);
    aplicarFiltros();
}

// ──────────────────────────────────────────
// TABELA
// ──────────────────────────────────────────
function renderizarTabela() {
    const tbody = document.querySelector('#tabela-clientes tbody');
    const inicio = (paginaAtual - 1) * CLIENTES_POR_PAGINA;
    const pagina = clientesFiltrados.slice(inicio, inicio + CLIENTES_POR_PAGINA);

    if (pagina.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="8" class="empty-state">
                Nenhum cliente encontrado.
            </td>
        </tr>`;
    } else {
        const permCpf = getPermissaoCampo('cpfCNPJ');
        const permEmail = getPermissaoCampo('email');
        const permTel = getPermissaoCampo('telefone');
        const permSaldo = getPermissaoCampo('saldoDevedor');

        tbody.innerHTML = pagina.map(c => {
            const tipo = c.razaoSocial ? 'PJ' : 'PF';
            const saldo = c.saldoDevedor != null
                ? `R$ ${Number(c.saldoDevedor).toFixed(2).replace('.', ',')}`
                : '—';

            return `<tr>
                <td class="area-acoes">
                    <button class="btn-acao btn-editar" 
                        title="Editar" 
                        onclick="abrirModalEdicao(${c.idCliente})">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn-acao btn-inativar"
                        title="${c.fAtivo ? 'Inativar' : 'Reativar'}"
                        onclick="confirmarDeletar(${c.idCliente})">
                        <i class="bi bi-${c.fAtivo
                    ? 'person-dash-fill'
                    : 'person-check-fill'}"></i>
                    </button>
                </td>
                <td>
                    <span class="status-pill status-${c.fAtivo
                    ? 'ativo' : 'inativo'}">
                        ${c.fAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>${tipo}</td>
                <td>${c.nome ?? '—'}</td>
                ${permCpf.visivel
                    ? `<td>${c.cpfCNPJ || '—'}</td>`
                    : ''}
                ${permEmail.visivel
                    ? `<td>${c.email || '—'}</td>`
                    : ''}
                ${permTel.visivel
                    ? `<td>${c.telefone || '—'}</td>`
                    : ''}
                ${permSaldo.visivel
                    ? `<td>${saldo}</td>`
                    : ''}
            </tr>`;
        }).join('');
    }

    // Oculta headers das colunas sem permissão
    const permCpf = getPermissaoCampo('cpfCNPJ');
    const permEmail = getPermissaoCampo('email');
    const permTel = getPermissaoCampo('telefone');
    const permSaldo = getPermissaoCampo('saldoDevedor');

    const headers = document.querySelectorAll('#tabela-clientes thead th');
    // índices: 0=Ações,1=Status,2=Tipo,3=Nome,4=CPF,5=Email,6=Tel,7=Saldo
    if (headers[4]) headers[4].style.display = permCpf.visivel ? '' : 'none';
    if (headers[5]) headers[5].style.display = permEmail.visivel ? '' : 'none';
    if (headers[6]) headers[6].style.display = permTel.visivel ? '' : 'none';
    if (headers[7]) headers[7].style.display = permSaldo.visivel ? '' : 'none';

    renderizarPaginacao();
}

function renderizarPaginacao() {
    const total = clientesFiltrados.length;
    const totalPaginas = Math.ceil(total / CLIENTES_POR_PAGINA);
    const inicio = total === 0 ? 0 : (paginaAtual - 1) * CLIENTES_POR_PAGINA + 1;
    const fim = Math.min(paginaAtual * CLIENTES_POR_PAGINA, total);
    document.querySelector(".paginacao-info").textContent =
        total === 0 ? "Nenhum registro" : `Mostrando ${inicio}–${fim} de ${total} clientes`;
    const controles = document.querySelector(".paginacao-controles");
    controles.innerHTML = "";
    controles.appendChild(criarBtnPagina("‹", paginaAtual === 1,
        () => { paginaAtual--; renderizarTabela(); }));
    for (let i = 1; i <= totalPaginas; i++) {
        const btn = criarBtnPagina(i, false, () => { paginaAtual = i; renderizarTabela(); });
        if (i === paginaAtual) btn.classList.add("ativo");
        controles.appendChild(btn);
    }
    controles.appendChild(criarBtnPagina("›", paginaAtual === totalPaginas || totalPaginas === 0,
        () => { paginaAtual++; renderizarTabela(); }));
}

function criarBtnPagina(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "btn-pagina";
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener("click", onClick);
    return btn;
}

// ──────────────────────────────────────────
// TIPO PF / PJ
// ──────────────────────────────────────────
function configurarTipoSelector(prefixo) {
    document.querySelectorAll(`.tipo-btn[data-prefixo="${prefixo}"]`).forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(`.tipo-btn[data-prefixo="${prefixo}"]`)
                .forEach(b => b.classList.remove("tipo-btn-ativo"));
            btn.classList.add("tipo-btn-ativo");
            alternarCamposPorTipo(prefixo, btn.dataset.tipo);
        });
    });
}

function alternarCamposPorTipo(prefixo, tipo) {
    const camposPF = [`${prefixo}-grupo-genero`, `${prefixo}-grupo-nascimento`, `${prefixo}-grupo-estadocivil`];
    const camposPJ = [`${prefixo}-grupo-razaosocial`];
    camposPF.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = tipo === "PF" ? "" : "none";
    });
    camposPJ.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = tipo === "PJ" ? "" : "none";
    });
    const labelNome = document.getElementById(`${prefixo}-label-nome`);
    const labelDoc = document.getElementById(`${prefixo}-label-doc`);
    const inputDoc = document.getElementById(`${prefixo}-doc`);
    if (labelNome) labelNome.innerHTML = tipo === "PF"
        ? 'Nome Completo <span class="obrigatorio">*</span>'
        : 'Nome Fantasia <span class="obrigatorio">*</span>';
    if (labelDoc) labelDoc.innerHTML = tipo === "PF"
        ? 'CPF <span class="obrigatorio">*</span>'
        : 'CNPJ <span class="obrigatorio">*</span>';
    if (inputDoc) {
        inputDoc.placeholder = tipo === "PF" ? "000.000.000-00" : "00.000.000/0000-00";
        // reaplica máscara correta
        inputDoc._listeners?.forEach(fn => inputDoc.removeEventListener("input", fn));
        if (tipo === "PF") aplicarMascaraCPF(inputDoc);
        else aplicarMascaraCNPJ(inputDoc);
    }
}

function getTipoAtivo(prefixo) {
    const btn = document.querySelector(`.tipo-btn[data-prefixo="${prefixo}"].tipo-btn-ativo`);
    return btn?.dataset.tipo ?? "PF";
}

// ──────────────────────────────────────────
// VALIDAÇÃO DO FORMULÁRIO
// ──────────────────────────────────────────
function validarFormCliente(prefixo) {
    const tipo = getTipoAtivo(prefixo);
    let ok = true;

    const nome = document.getElementById(`${prefixo}-nome`);
    const doc = document.getElementById(`${prefixo}-doc`);
    const email = document.getElementById(`${prefixo}-email`);
    const tel = document.getElementById(`${prefixo}-telefone`);
    const logr = document.getElementById(`${prefixo}-logradouro`);
    const num = document.getElementById(`${prefixo}-numero`);
    const cidade = document.getElementById(`${prefixo}-cidade`);
    const estado = document.getElementById(`${prefixo}-estado`);

    if (!validarObrigatorio(nome, "Nome")) ok = false;
    if (!validarCampoCpfCnpj(doc, tipo)) ok = false;
    if (!validarCampoEmail(email, true)) ok = false;
    if (!validarCampoTelefone(tel, true)) ok = false;
    if (!validarObrigatorio(logr, "Logradouro")) ok = false;
    if (!validarObrigatorio(num, "Número")) ok = false;
    if (!validarObrigatorio(cidade, "Cidade")) ok = false;
    if (!validarObrigatorio(estado, "Estado")) ok = false;

    // CEP: opcional mas se preenchido deve ser válido
    const cep = document.getElementById(`${prefixo}-cep`);
    if (cep && !campoVazio(cep.value)) {
        const digits = cep.value.replace(/\D/g, "");
        if (!validarCEP(digits)) {
            marcarErro(cep, "CEP inválido. Informe 8 dígitos.");
            ok = false;
        } else {
            limparErro(cep);
        }
    }

    if (!ok) flexToast("Corrija os campos destacados antes de salvar.", "aviso");
    return ok;
}

// ──────────────────────────────────────────
// MONTAR PAYLOAD
// ──────────────────────────────────────────
function lerCampo(id) {
    const el = document.getElementById(id);
    return el ? (el.value.trim() || null) : null;
}
function lerCampoNum(id) {
    const v = lerCampo(id);
    return v !== null ? Number(v) : null;
}
function setCampo(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor ?? "";
}

function montarPayloadNovo() {
    const tipo = getTipoAtivo("novo");
    return {
        Cliente: {
            nome: lerCampo("novo-nome"),
            nomeFantasia: tipo === "PJ" ? lerCampo("novo-nome") : null,
            razaoSocial: tipo === "PJ" ? lerCampo("novo-razaosocial") : null,
            cpfCNPJ: (lerCampo("novo-doc") ?? "").replace(/\D/g, ""),
            email: lerCampo("novo-email"),
            telefone: (lerCampo("novo-telefone") ?? "").replace(/\D/g, ""),
            tipoCliente_id: lerCampoNum("novo-tipocliente") ?? 1,
            observacao: lerCampo("novo-observacao"),
            genero: tipo === "PF" ? lerCampo("novo-genero") : null,
            dthNascimento: tipo === "PF" ? lerCampo("novo-nascimento") : null,
            saldoDevedor: lerCampoNum("novo-saldo") ?? 0
        },
        Endereco: {
            tipoEndereco: 1,
            logradouro: lerCampo("novo-logradouro") ?? "",
            numero: lerCampo("novo-numero") ?? "",
            complemento: lerCampo("novo-complemento"),
            bairro: lerCampo("novo-bairro") ?? "",
            cidade: lerCampo("novo-cidade") ?? "",
            estado: lerCampo("novo-estado") ?? "",
            pais: "Brasil",
            cep: (lerCampo("novo-cep") ?? "").replace(/\D/g, ""),
            fAtivo: 1
        }
    };
}

function montarPayloadEdicao() {
    const tipo = getTipoAtivo("edit");
    return {
        Cliente: {
            idCliente: clienteEmEdicao.idCliente,
            nome: lerCampo("edit-nome"),
            nomeFantasia: tipo === "PJ" ? lerCampo("edit-nome") : null,
            razaoSocial: tipo === "PJ" ? lerCampo("edit-razaosocial") : null,
            cpfCNPJ: (lerCampo("edit-doc") ?? "").replace(/\D/g, ""),
            email: lerCampo("edit-email"),
            telefone: lerCampo("edit-telefone"),
            tipoCliente_id: lerCampoNum("edit-tipocliente") ?? 1,
            observacao: lerCampo("edit-observacao"),
            genero: tipo === "PF" ? lerCampo("edit-genero") : null,
            dthNascimento: tipo === "PF" ? lerCampo("edit-nascimento") : null,
            enderecoId: clienteEmEdicao.enderecoId,
            saldoDevedor: lerCampo("edit-saldo")
        },
        Endereco: {
            idEndereco: clienteEmEdicao.enderecoId,
            tipoEndereco: clienteEmEdicao.tipoEndereco ?? 1,
            logradouro: lerCampo("edit-logradouro") ?? "",
            numero: lerCampo("edit-numero") ?? "",
            complemento: lerCampo("edit-complemento"),
            bairro: lerCampo("edit-bairro") ?? "",
            cidade: lerCampo("edit-cidade") ?? "",
            estado: lerCampo("edit-estado") ?? "",
            pais: "Brasil",
            cep: (lerCampo("edit-cep") ?? "").replace(/\D/g, "")
        }
    };
}

// ──────────────────────────────────────────
// MODAL NOVO CLIENTE
// ──────────────────────────────────────────
function abrirModal() {
    const form = document.getElementById('form-cliente');
    form.reset();
    limparTodosErros(form);

    // Reseta visibilidade antes de aplicar permissões
    form.querySelectorAll('.form-group').forEach(g => g.style.display = '');
    form.querySelectorAll('input, select, textarea').forEach(el => {
        el.removeAttribute('readonly');
        el.style.background = '';
        el.style.color = '';
        el.style.cursor = '';
        el.style.pointerEvents = '';
        el.style.appearance = '';
    });
    form.querySelectorAll('.readonly-badge').forEach(b => b.remove());

    document.querySelectorAll('.tipo-btn[data-prefixo="novo"]')
        .forEach(b => b.classList.remove('tipo-btn-ativo'));
    document.querySelector('.tipo-btn[data-prefixo="novo"][data-tipo="PF"]')
        .classList.add('tipo-btn-ativo');
    alternarCamposPorTipo('novo', 'PF');

    // Aplica permissões após montar o modal
    aplicarPermissoesCampos('novo');

    document.getElementById('modal-novo-cliente').classList.add('open');
}

function fecharModal() {
    document.getElementById("modal-novo-cliente").classList.remove("open");
}

document.getElementById("form-cliente").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validarFormCliente("novo")) return;

    const btnTexto = this.querySelector(".btn-texto");
    const btnLoading = this.querySelector(".btn-loading");
    const btnSubmit = this.querySelector('[type="submit"]');
    btnSubmit.disabled = true;
    btnTexto.style.display = "none";
    btnLoading.style.display = "";

    try {
        await apiPost("/Cliente/Criar", montarPayloadNovo());
        fecharModal();
        await carregarClientes();
        flexToast("Cliente cadastrado com sucesso!", "sucesso");
    } catch (err) {
        flexToast("Erro ao criar cliente: " + err.message, "erro");
    } finally {
        btnSubmit.disabled = false;
        btnTexto.style.display = "";
        btnLoading.style.display = "none";
    }
});

// ──────────────────────────────────────────
// MODAL EDIÇÃO
// ──────────────────────────────────────────
function abrirModalEdicao(id) {
    clienteEmEdicao = todosClientes.find(c => c.idCliente === id);
    if (!clienteEmEdicao) return;

    const form = document.getElementById('form-edicao');
    limparTodosErros(form);

    // Reseta visibilidade
    form.querySelectorAll('.form-group').forEach(g => g.style.display = '');
    form.querySelectorAll('input, select, textarea').forEach(el => {
        el.removeAttribute('readonly');
        el.style.background = '';
        el.style.color = '';
        el.style.cursor = '';
        el.style.pointerEvents = '';
        el.style.appearance = '';
    });
    form.querySelectorAll('.readonly-badge').forEach(b => b.remove());

    const tipo = clienteEmEdicao.razaoSocial ? 'PJ' : 'PF';
    document.querySelectorAll('.tipo-btn[data-prefixo="edit"]')
        .forEach(b => b.classList.remove('tipo-btn-ativo'));
    document.querySelector(`.tipo-btn[data-prefixo="edit"][data-tipo="${tipo}"]`)
        .classList.add('tipo-btn-ativo');
    alternarCamposPorTipo('edit', tipo);

    const c = clienteEmEdicao;
    setCampo('edit-nome', c.nome);
    setCampo('edit-doc', c.cpfCNPJ);
    setCampo('edit-email', c.email);
    setCampo('edit-telefone', c.telefone);
    setCampo('edit-tipocliente', c.tipoCliente_id);
    setCampo('edit-observacao', c.observacao);
    setCampo('edit-genero', c.genero);
    setCampo('edit-razaosocial', c.razaoSocial);
    setCampo('edit-saldo', c.saldoDevedor);
    if (c.dthNascimento) setCampo('edit-nascimento', c.dthNascimento.substring(0, 10));
    if (c.dthCadastro) setCampo('edit-cadastro',
        new Date(c.dthCadastro).toLocaleDateString('pt-BR'));
    setCampo('edit-logradouro', c.logradouro);
    setCampo('edit-numero', c.numero);
    setCampo('edit-complemento', c.complemento);
    setCampo('edit-bairro', c.bairro);
    setCampo('edit-cidade', c.cidade);
    setCampo('edit-estado', c.estado);
    setCampo('edit-cep', c.cep);

    // Aplica permissões após preencher os campos
    aplicarPermissoesCampos('edit');

    document.getElementById('modal-edicao').classList.add('open');
}

function fecharModalEdicao() {
    document.getElementById("modal-edicao").classList.remove("open");
    clienteEmEdicao = null;
}

document.getElementById("form-edicao").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!clienteEmEdicao) return;
    if (!validarFormCliente("edit")) return;

    const btnTexto = this.querySelector(".btn-texto");
    const btnLoading = this.querySelector(".btn-loading");
    const btnSubmit = this.querySelector('[type="submit"]');
    btnSubmit.disabled = true;
    btnTexto.style.display = "none";
    btnLoading.style.display = "";

    try {
        await apiPost("/Cliente/Editar", montarPayloadEdicao());
        fecharModalEdicao();
        await carregarClientes();
        flexToast("Cliente atualizado com sucesso!", "sucesso");
    } catch (err) {
        flexToast("Erro ao salvar cliente: " + err.message, "erro");
    } finally {
        btnSubmit.disabled = false;
        btnTexto.style.display = "";
        btnLoading.style.display = "none";
    }
});

// ──────────────────────────────────────────
// EXCLUSÃO LÓGICA (inativar/reativar)
// ──────────────────────────────────────────
function confirmarDeletar(id) {
    clienteParaDeletar = todosClientes.find(c => c.idCliente === id);
    if (!clienteParaDeletar) return;

    const acao = clienteParaDeletar.fAtivo ? "inativado" : "reativado";
    const btnTexto = clienteParaDeletar.fAtivo ? "Sim, inativar" : "Sim, reativar";

    flexConfirmar(
        `Deseja ${acao} o cliente "${clienteParaDeletar.nome}"?\n(O registro não será excluído do sistema.)`,
        async () => {
            try {
                await apiPost("/Cliente/Deletar", clienteParaDeletar.idCliente);
                await carregarClientes();
                flexToast(`Cliente ${acao} do com sucesso!`, "sucesso");
            } catch (err) {
                flexToast("Erro ao alterar status: " + err.message, "erro");
            }
        },
        btnTexto
    );
}

// ──────────────────────────────────────────
// FECHAR CLICANDO FORA DO MODAL
// ──────────────────────────────────────────
["modal-novo-cliente", "modal-edicao", "modal-confirmar"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", function (e) {
        if (e.target !== this) return;
        if (id === "modal-novo-cliente") fecharModal();
        else if (id === "modal-edicao") fecharModalEdicao();
    });
});

document.getElementById("btn-abrir-modal")?.addEventListener("click", abrirModal);
document.getElementById("btn-fechar-novo")?.addEventListener("click", fecharModal);
document.getElementById("btn-cancelar-novo")?.addEventListener("click", fecharModal);
document.getElementById("btn-fechar-edicao")?.addEventListener("click", fecharModalEdicao);
document.getElementById("btn-cancelar-edicao")?.addEventListener("click", fecharModalEdicao);
document.getElementById("select-tipo-filtro")?.addEventListener("change", filtrarTabela);
document.getElementById("input-termo-busca")?.addEventListener("input", filtrarTabela);

// ──────────────────────────────────────────
// INIT — aplica máscaras e CEP automático
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    configurarTipoSelector('novo');
    configurarTipoSelector('edit');
    document.getElementById('btn-filtro-todos').classList.add('ativo-sel');

    // Carrega permissões ANTES de carregar clientes
    await carregarPermissoesCampos();

    // Máscaras
    ['novo-telefone', 'edit-telefone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) aplicarMascaraTelefone(el);
    });
    ['novo-doc', 'edit-doc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) aplicarMascaraCPF(el);
    });
    ['novo-cep', 'edit-cep'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        aplicarMascaraCEP(el);
        const prefixo = id.replace('-cep', '');
        el.addEventListener('blur', () => preencherEnderecoPorCEP(el, prefixo));
    });

    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', () => limparErro(el));
        el.addEventListener('change', () => limparErro(el));
    });

    // Oculta botão novo cliente se não tiver permissão de edição em nenhum campo
    if (!isAdmin) {
        const algumEditavel = permissoesCampos.some(c => c.editavel);
        if (!algumEditavel) {
            document.getElementById('btn-abrir-modal')?.style
                .setProperty('display', 'none');
        }
    }

    await carregarClientes();
});